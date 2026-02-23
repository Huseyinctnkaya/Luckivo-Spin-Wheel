import { json } from "@remix-run/node";
import { authenticate, unauthenticated } from "../shopify.server";
import db from "../db.server";
import { sendDiscountEmail } from "../email.server";

function toBoolean(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "off", ""].includes(normalized)) return false;
    }
    return fallback;
}

function parseWheelSettings(rawConfig) {
    try {
        const parsed = JSON.parse(rawConfig || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function isNoRewardResult({ label, couponCode }) {
    const normalizedCode = String(couponCode || "").trim().toUpperCase();
    const noRewardCode =
        !normalizedCode ||
        normalizedCode === "NONE" ||
        normalizedCode === "NO_DISCOUNT";
    const noRewardLabel = /try\s*again|no\s*luck/i.test(String(label || ""));
    return noRewardCode || noRewardLabel;
}

export const loader = async ({ request }) => {
    try {
        const noStoreHeaders = {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
        };

        const { session } = await authenticate.public.appProxy(request);

        if (!session) return json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });

        const { pathname } = new URL(request.url);

        // Subpath: apps/wheel-proxy/active-wheel
        if (pathname.endsWith("/active-wheel")) {
            const [wheel, customCodeRecord] = await Promise.all([
                db.wheel.findFirst({
                    where: { shop: session.shop, isActive: true },
                    include: { segments: true },
                    orderBy: { updatedAt: "desc" },
                }),
                db.customCode.findUnique({ where: { shop: session.shop } }),
            ]);

            return json({ wheel, customCode: customCodeRecord?.code || "" }, { headers: noStoreHeaders });
        }

        return json({ error: "Not Found" }, { status: 404, headers: noStoreHeaders });
    } catch (error) {
        console.error("App proxy loader failed:", error);
        return json({ error: "Proxy loader failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
};

export const action = async ({ request }) => {
    try {
        const { session } = await authenticate.public.appProxy(request);

        if (!session) return json({ error: "Unauthorized" }, { status: 401 });

        const { pathname } = new URL(request.url);

        if (pathname.endsWith("/spin")) {
            const body = await request.json();
            const { wheelId, email } = body;

            const wheel = await db.wheel.findUnique({
                where: { id: wheelId },
                include: { segments: true }
            });

            if (!wheel || !wheel.isActive) {
                return json({ error: "Wheel not active" }, { status: 400 });
            }

            if (wheel.shop !== session.shop) {
                return json({ error: "Wheel not found for this shop" }, { status: 404 });
            }

            const wheelSettings = parseWheelSettings(wheel.config);

            const syncToShopifyCustomers = toBoolean(wheelSettings.syncToShopifyCustomers, false);
            const rawEmail = String(email || "").trim();
            const normalizedEmail = rawEmail.toLowerCase();

            // Calculate result based on probability
            const result = calculateSpinResult(wheel.segments);

            // Create spin record
            const spinRecord = await db.spin.create({
                data: {
                    wheelId: wheel.id,
                    customerEmail: normalizedEmail || rawEmail || null,
                    result: result.label,
                    couponCode: result.value, // In real app, might generate a unique code here
                }
            });

            const rawName = String(body?.name || "").trim();
            const rawPhone = String(body?.phone || "").trim();
            const consentAccepted = toBoolean(body?.consentAccepted, false);

            if (syncToShopifyCustomers && normalizedEmail) {
                try {
                    await syncSpinCustomerToShopify({
                        shop: session.shop,
                        email: normalizedEmail,
                        name: rawName,
                        phone: rawPhone,
                        consentAccepted,
                    });
                } catch (syncError) {
                    console.error("Customer sync failed:", syncError);
                }
            }

            const isNoReward = isNoRewardResult({
                label: result.label,
                couponCode: result.value,
            });

            if (normalizedEmail && !isNoReward) {
                try {
                    const emailSettings = await db.emailSettings.findUnique({
                        where: { shop: session.shop },
                    });

                    if (emailSettings?.enabled) {
                        await sendDiscountEmail({
                            to: normalizedEmail,
                            couponCode: result.value,
                            reward: result.label,
                            shopName: session.shop.replace(".myshopify.com", ""),
                            fromEmail: emailSettings.fromEmail || undefined,
                            fromName: emailSettings.fromName || undefined,
                            subject: emailSettings.subject || undefined,
                            headerTitle: emailSettings.headerTitle || undefined,
                            headerSubtitle: emailSettings.headerSubtitle || undefined,
                            headerEmoji: emailSettings.headerEmoji || undefined,
                            brandColor: emailSettings.brandColor || undefined,
                            ctaText: emailSettings.ctaText || undefined,
                            ctaUrl: emailSettings.ctaUrl || undefined,
                        });
                    }
                } catch (emailError) {
                    console.error("Email send failed:", emailError);
                }
            }

            return json({
                spinId: spinRecord.id,
                segmentId: result.id,
                label: result.label,
                couponCode: result.value
            });
        }

        if (pathname.endsWith("/finalize-spin")) {
            const body = await request.json();
            const spinId = String(body?.spinId || "").trim();
            const wheelId = String(body?.wheelId || "").trim();

            if (!spinId || !wheelId) {
                return json({ error: "Missing spinId or wheelId" }, { status: 400 });
            }

            const spin = await db.spin.findUnique({
                where: { id: spinId },
                include: {
                    wheel: {
                        select: {
                            id: true,
                            shop: true,
                            config: true,
                        },
                    },
                },
            });

            if (!spin || spin.wheelId !== wheelId || spin.wheel?.shop !== session.shop) {
                return json({ error: "Spin not found for this shop" }, { status: 404 });
            }

            const wheelSettings = parseWheelSettings(spin.wheel?.config);
            const syncToShopifyCustomers = toBoolean(wheelSettings.syncToShopifyCustomers, false);
            const rawEmail = String(body?.email || "").trim();
            const normalizedEmail = rawEmail.toLowerCase();
            const rawName = String(body?.name || "").trim();
            const rawPhone = String(body?.phone || "").trim();
            const consentAccepted = toBoolean(body?.consentAccepted, false);

            const previousEmail = String(spin.customerEmail || "").trim().toLowerCase();
            const shouldUpdateSpinEmail = Boolean(normalizedEmail) && previousEmail !== normalizedEmail;

            if (shouldUpdateSpinEmail) {
                await db.spin.update({
                    where: { id: spin.id },
                    data: {
                        customerEmail: normalizedEmail,
                    },
                });
            }

            if (syncToShopifyCustomers && normalizedEmail) {
                try {
                    await syncSpinCustomerToShopify({
                        shop: session.shop,
                        email: normalizedEmail,
                        name: rawName,
                        phone: rawPhone,
                        consentAccepted,
                    });
                } catch (syncError) {
                    console.error("Customer sync failed:", syncError);
                }
            }

            const isNoReward = isNoRewardResult({
                label: spin.result,
                couponCode: spin.couponCode,
            });
            const shouldSendEmail = Boolean(normalizedEmail) && !isNoReward && previousEmail !== normalizedEmail;

            if (shouldSendEmail) {
                try {
                    const emailSettings = await db.emailSettings.findUnique({
                        where: { shop: session.shop },
                    });

                    if (emailSettings?.enabled) {
                        await sendDiscountEmail({
                            to: normalizedEmail,
                            couponCode: spin.couponCode || "",
                            reward: spin.result,
                            shopName: session.shop.replace(".myshopify.com", ""),
                            fromEmail: emailSettings.fromEmail || undefined,
                            fromName: emailSettings.fromName || undefined,
                            subject: emailSettings.subject || undefined,
                            headerTitle: emailSettings.headerTitle || undefined,
                            headerSubtitle: emailSettings.headerSubtitle || undefined,
                            headerEmoji: emailSettings.headerEmoji || undefined,
                            brandColor: emailSettings.brandColor || undefined,
                            ctaText: emailSettings.ctaText || undefined,
                            ctaUrl: emailSettings.ctaUrl || undefined,
                        });
                    }
                } catch (emailError) {
                    console.error("Email send failed:", emailError);
                }
            }

            return json({
                success: true,
                spinId: spin.id,
                label: spin.result,
                couponCode: spin.couponCode || "",
            });
        }

        if (pathname.endsWith("/track-impression")) {
            const body = await request.json();
            const { wheelId } = body;

            const wheel = await db.wheel.findUnique({
                where: { id: wheelId },
                select: { shop: true },
            });

            if (!wheel || wheel.shop !== session.shop) {
                return json({ error: "Wheel not found for this shop" }, { status: 404 });
            }

            await db.impression.create({
                data: {
                    wheelId,
                    shop: session.shop
                }
            });

            return json({ success: true });
        }

        return json({ error: "Not Found" }, { status: 404 });
    } catch (error) {
        console.error("App proxy action failed:", error);
        return json({ error: "Proxy action failed" }, { status: 500 });
    }
};

function calculateSpinResult(segments) {
    const totalProb = segments.reduce((acc, s) => acc + s.probability, 0);
    let random = Math.random() * totalProb;

    for (const segment of segments) {
        if (random < segment.probability) {
            return segment;
        }
        random -= segment.probability;
    }

    return segments[0]; // Fallback
}

function splitFullName(name) {
    const clean = String(name || "").trim().replace(/\s+/g, " ");
    if (!clean) return { firstName: "", lastName: "" };
    const parts = clean.split(" ");
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(" "),
    };
}

function flattenGraphQlErrors(payload) {
    if (!Array.isArray(payload?.errors)) return "";
    return payload.errors
        .map((error) => String(error?.message || "").trim())
        .filter(Boolean)
        .join("; ");
}

function flattenUserErrors(userErrors) {
    if (!Array.isArray(userErrors)) return "";
    return userErrors
        .map((error) => String(error?.message || "").trim())
        .filter(Boolean)
        .join("; ");
}

function isMarketingFieldError(message) {
    const lower = String(message || "").toLowerCase();
    return lower.includes("acceptsmarketing") || lower.includes("marketing");
}

async function runAdminGraphql(admin, query, variables) {
    const response = await admin.graphql(query, { variables });
    const payload = await response.json();

    if (!response.ok) {
        const graphMessage = flattenGraphQlErrors(payload);
        const fallbackText = typeof payload === "string" ? payload : JSON.stringify(payload);
        throw new Error(graphMessage || fallbackText || "Shopify Admin request failed");
    }

    const graphMessage = flattenGraphQlErrors(payload);
    if (graphMessage) {
        throw new Error(graphMessage);
    }

    return payload;
}

async function findShopifyCustomerByEmail(admin, email) {
    const query = `#graphql
      query FindCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          nodes {
            id
            email
          }
        }
      }
    `;

    const payload = await runAdminGraphql(admin, query, {
        query: `email:${email}`,
    });

    return payload?.data?.customers?.nodes?.[0] || null;
}

async function createShopifyCustomer(admin, customerPayload) {
    const mutation = `#graphql
      mutation CustomerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const { firstName, lastName } = splitFullName(customerPayload.name);
    const tags = ["Luckivo Spin Wheel"];
    if (customerPayload.consentAccepted) {
        tags.push("Luckivo Consent");
    }

    const baseInput = {
        email: customerPayload.email,
        tags,
    };

    if (firstName) baseInput.firstName = firstName;
    if (lastName) baseInput.lastName = lastName;
    if (customerPayload.phone) baseInput.phone = customerPayload.phone;
    if (customerPayload.consentAccepted) {
        baseInput.acceptsMarketing = true;
    }

    const attempts = [baseInput];
    if (baseInput.acceptsMarketing) {
        const fallbackInput = { ...baseInput };
        delete fallbackInput.acceptsMarketing;
        attempts.push(fallbackInput);
    }

    for (let index = 0; index < attempts.length; index += 1) {
        const input = attempts[index];
        const canRetryWithoutMarketing =
            index < attempts.length - 1 && Object.prototype.hasOwnProperty.call(input, "acceptsMarketing");

        try {
            const payload = await runAdminGraphql(admin, mutation, { input });
            const result = payload?.data?.customerCreate;
            const userErrors = result?.userErrors || [];
            const userErrorMessage = flattenUserErrors(userErrors);

            if (userErrorMessage) {
                const lowerMessage = userErrorMessage.toLowerCase();
                if (
                    lowerMessage.includes("already exists") ||
                    lowerMessage.includes("has already been taken")
                ) {
                    return null;
                }

                if (canRetryWithoutMarketing && isMarketingFieldError(userErrorMessage)) {
                    continue;
                }

                throw new Error(userErrorMessage);
            }

            return result?.customer || null;
        } catch (error) {
            const message = String(error?.message || "");
            if (canRetryWithoutMarketing && isMarketingFieldError(message)) {
                continue;
            }
            throw error;
        }
    }

    return null;
}

async function syncSpinCustomerToShopify({ shop, email, name, phone, consentAccepted }) {
    if (!shop || !email) return null;

    const { admin } = await unauthenticated.admin(shop);
    const existingCustomer = await findShopifyCustomerByEmail(admin, email);
    if (existingCustomer) return existingCustomer;

    return createShopifyCustomer(admin, {
        email,
        name,
        phone,
        consentAccepted,
    });
}
