import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { PLANS } from "../plans";
import { Page, Card, Text, BlockStack, InlineStack, Button, Badge } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);

  const billingCheck = await billing
    .check({
      plans: [PLANS.PREMIUM_MONTHLY],
      isTest: process.env.NODE_ENV !== "production",
    })
    .catch(() => ({ hasActivePayment: false, appSubscriptions: [] }));

  const isActive = billingCheck.hasActivePayment;

  // Detect if still in trial
  const activeSub = billingCheck.appSubscriptions?.[0];
  const isOnTrial =
    isActive &&
    activeSub?.trialDays > 0 &&
    activeSub?.status === "ACTIVE" &&
    activeSub?.currentPeriodEnd != null &&
    new Date(activeSub.currentPeriodEnd) > new Date();

  return json({ isActive, isOnTrial });
};

export const action = async ({ request }) => {
  const { billing } = await authenticate.admin(request);

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
  const { isActive, isOnTrial } = useLoaderData();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  const handleStart = () => {
    fetcher.submit({}, { method: "post" });
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
                    ? "You are currently in your free trial."
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
                loading={isSubmitting}
                onClick={handleStart}
              >
                {isActive ? "Current Plan" : "Start 7-day free trial"}
              </Button>
            </div>
          </BlockStack>
        </Card>
      </div>
    </Page>
  );
}
