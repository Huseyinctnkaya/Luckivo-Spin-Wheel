import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { PLANS } from "../plans";
import { Page, Card, Text, BlockStack, InlineStack, Button, Badge } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);
  const defaultIsTest = process.env.NODE_ENV !== "production";
  const checkOptions = [defaultIsTest, !defaultIsTest];
  const billingChecks = await Promise.all(
    checkOptions.map((isTest) =>
      billing
        .check({
          plans: [PLANS.PREMIUM_MONTHLY],
          isTest,
        })
        .catch(() => ({ hasActivePayment: false, appSubscriptions: [] })),
    ),
  );

  const billingCheck =
    billingChecks.find((check) => check.hasActivePayment) ??
    billingChecks[0] ?? { hasActivePayment: false, appSubscriptions: [] };

  const isActive = billingCheck.hasActivePayment;

  // Pick the currently active subscription when available.
  const activeSub =
    billingCheck.appSubscriptions?.find((subscription) => subscription.status === "ACTIVE") ??
    billingCheck.appSubscriptions?.[0];
  const createdAt = activeSub?.createdAt ? new Date(activeSub.createdAt) : null;
  const trialEndsAt =
    createdAt && activeSub?.trialDays > 0
      ? new Date(createdAt.getTime() + activeSub.trialDays * 24 * 60 * 60 * 1000)
      : null;
  const isOnTrial =
    isActive &&
    activeSub?.status === "ACTIVE" &&
    activeSub?.trialDays > 0 &&
    trialEndsAt != null &&
    trialEndsAt > new Date();

  return json({
    isActive,
    isOnTrial,
    subscriptionId: activeSub?.id ?? null,
    subscriptionIsTest: activeSub?.test ?? defaultIsTest,
    trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
  });
};

export const action = async ({ request }) => {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "cancel") {
    const subscriptionId = formData.get("subscriptionId");
    const subscriptionIsTest = formData.get("subscriptionIsTest") === "true";

    if (typeof subscriptionId !== "string" || !subscriptionId) {
      return json({ error: "Missing subscription id" }, { status: 400 });
    }

    await billing.cancel({
      subscriptionId,
      isTest: subscriptionIsTest,
      prorate: false,
    });

    return redirect(`https://${session.shop}/admin/settings/billing`);
  }

  await billing.request({
    plan: PLANS.PREMIUM_MONTHLY,
    isTest: process.env.NODE_ENV !== "production",
    returnUrl: `${process.env.SHOPIFY_APP_URL}/app/plans`,
  });

  return null;
};

const FEATURES = [
  "Unlimited spin wheel campaigns",
  "Unlimited submissions",
  "Advanced design customization",
  "Full analytics & date ranges",
  "Import / export tools",
  "Email notifications",
  "Priority support",
];

export default function PlansPage() {
  const { isActive, isOnTrial, subscriptionId, subscriptionIsTest, trialEndsAt } = useLoaderData();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";
  const activeIntent = fetcher.formData?.get("intent");
  const isStarting = isSubmitting && activeIntent === "start";
  const isCancelling = isSubmitting && activeIntent === "cancel";
  const ctaLabel = isOnTrial
    ? "Trial Active"
    : isActive
      ? "Current Plan"
      : "Start 7-day free trial";

  const handleStart = () => {
    fetcher.submit({ intent: "start" }, { method: "post" });
  };

  const handleCancel = () => {
    if (!subscriptionId) return;
    fetcher.submit(
      { intent: "cancel", subscriptionId, subscriptionIsTest: String(subscriptionIsTest) },
      { method: "post" },
    );
  };

  return (
    <Page title="Plans">
      <div style={{ maxWidth: "480px" }}>
        <Card>
          <BlockStack gap="400">
            {/* Header */}
            <InlineStack gap="200" blockAlign="center">
              <Text as="h2" variant="headingLg" fontWeight="bold">
                Premium
              </Text>
              {isActive && !isOnTrial && (
                <Badge tone="success">Active</Badge>
              )}
              {isOnTrial && (
                <Badge tone="info">Trial</Badge>
              )}
            </InlineStack>

            <Text as="p" tone="subdued">
              Everything you need to grow your store with spin wheel campaigns.
            </Text>

            {/* Price */}
            <div>
              <InlineStack gap="100" blockAlign="end">
                <Text as="p" variant="heading2xl" fontWeight="bold">
                  $3.99
                </Text>
                <Text as="p" tone="subdued">
                  /month
                </Text>
              </InlineStack>
              <Text as="p" tone="subdued" variant="bodySm">
                {isActive
                  ? isOnTrial
                    ? `You are currently in your free trial${trialEndsAt ? ` until ${new Date(trialEndsAt).toLocaleDateString("en-US")}` : ""}.`
                    : "Your subscription is active."
                  : "Includes a 7-day free trial. Cancel anytime."}
              </Text>
            </div>

            {/* Features */}
            <BlockStack gap="200">
              {FEATURES.map((feature) => (
                <InlineStack key={feature} gap="200" blockAlign="center">
                  <span
                    style={{
                      width: "16px",
                      height: "16px",
                      minWidth: "16px",
                      borderRadius: "999px",
                      border: "1.5px solid #303030",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "999px",
                        background: "#303030",
                        display: "inline-block",
                      }}
                    />
                  </span>
                  <Text as="span">{feature}</Text>
                </InlineStack>
              ))}
            </BlockStack>

            {/* CTA */}
            <div style={{ marginTop: "8px" }}>
              <Button
                fullWidth
                variant="primary"
                disabled={isActive}
                loading={isStarting}
                onClick={handleStart}
              >
                {ctaLabel}
              </Button>
            </div>
            {isActive && subscriptionId && (
              <Button
                fullWidth
                tone="critical"
                variant="plain"
                loading={isCancelling}
                onClick={handleCancel}
              >
                Cancel plan
              </Button>
            )}
          </BlockStack>
        </Card>
      </div>
    </Page>
  );
}
