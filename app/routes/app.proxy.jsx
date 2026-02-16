import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
    const { session, url } = await authenticate.public.appProxy(request);

    if (!session) return json({ error: "Unauthorized" }, { status: 401 });

    const { pathname } = new URL(url);

    // Subpath: apps/wheel-proxy/active-wheel
    if (pathname.endsWith("/active-wheel")) {
        const wheel = await db.wheel.findFirst({
            where: { shop: session.shop, isActive: true },
            include: { segments: true }
        });

        return json({ wheel });
    }

    return json({ error: "Not Found" }, { status: 404 });
};

export const action = async ({ request }) => {
    const { session, url } = await authenticate.public.appProxy(request);

    if (!session) return json({ error: "Unauthorized" }, { status: 401 });

    const { pathname } = new URL(url);

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

        // Calculate result based on probability
        const result = calculateSpinResult(wheel.segments);

        // Create spin record
        await db.spin.create({
            data: {
                wheelId: wheel.id,
                customerEmail: email,
                result: result.label,
                couponCode: result.value, // In real app, might generate a unique code here
            }
        });

        return json({
            segmentId: result.id,
            label: result.label,
            couponCode: result.value
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
