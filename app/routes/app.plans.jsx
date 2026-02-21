import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, useFetcher } from "@remix-run/react";
import { useMemo } from "react";
import { authenticate, PLANS } from "../shopify.server";
import { Page, Card, Text, BlockStack, InlineStack, Button } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);

  const billingCheck = await billing
    .check({
      plans: [PLANS.PREMIUM_MONTHLY, PLANS.PREMIUM_YEARLY],
      isTest: process.env.NODE_ENV !== "production",
    })
    .catch(() => ({ hasActivePayment: false, appSubscriptions: [] }));

  let currentPlan = "free";
  if (billingCheck.hasActivePayment && billingCheck.appSubscriptions?.length > 0) {
    const sub = billingCheck.appSubscriptions[0];
    currentPlan =
      sub.name === PLANS.PREMIUM_YEARLY ? "premium_yearly" : "premium_monthly";
  }

  return json({ currentPlan });
};

export const action = async ({ request }) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan");

  if (!Object.values(PLANS).includes(plan)) {
    return json({ error: "Invalid plan." }, { status: 400 });
  }

  await billing.request({
    plan,
    isTest: process.env.NODE_ENV !== "production",
    returnUrl: `${process.env.SHOPIFY_APP_URL}/app/plans`,
  });

  // billing.request() throws a redirect — this line is never reached
  return null;
};

const FREE_FEATURES = [
  "Up to 30 submissions per month",
  "Template-based campaign builder",
  "Basic design customization",
  "Subscribers list",
  "Core analytics",
  "Email support",
];

const PREMIUM_FEATURES = [
  "Unlimited submissions",
  "Unlimited campaigns",
  "Advanced design customization",
  "Full analytics and date ranges",
  "Import/export tools",
  "Priority support",
];

export default function PlansPage() {
  const { currentPlan } = useLoaderData();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const billingPeriod = searchParams.get("billing") === "yearly" ? "yearly" : "monthly";
  const isSubmitting = fetcher.state !== "idle";
  const isPremium = currentPlan === "premium_monthly" || currentPlan === "premium_yearly";

  const setBillingPeriod = (period) => {
    const params = new URLSearchParams(searchParams);
    params.set("billing", period);
    setSearchParams(params, { replace: true });
  };

  const premiumPricing = useMemo(() => {
    if (billingPeriod === "yearly") {
      return { amount: "$39.99", suffix: "/year", note: "Billed yearly" };
    }
    return { amount: "$3.99", suffix: "/month", note: "7-day free trial included" };
  }, [billingPeriod]);

  const handleSelectPremium = () => {
    const plan =
      billingPeriod === "yearly" ? PLANS.PREMIUM_YEARLY : PLANS.PREMIUM_MONTHLY;
    fetcher.submit({ plan }, { method: "post" });
  };

  return (
    <Page title="Plans">
      <BlockStack gap="500">
        {/* Billing period toggle */}
        <InlineStack>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid #c5c7cc",
              borderRadius: "10px",
              overflow: "hidden",
              background: "#f6f6f7",
            }}
          >
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              style={{
                border: "none",
                background: billingPeriod === "monthly" ? "#2f3136" : "transparent",
                color: billingPeriod === "monthly" ? "#ffffff" : "#303030",
                padding: "8px 14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("yearly")}
              style={{
                border: "none",
                borderLeft: "1px solid #c9cccf",
                background: billingPeriod === "yearly" ? "#2f3136" : "transparent",
                color: billingPeriod === "yearly" ? "#ffffff" : "#303030",
                padding: "8px 14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Yearly
            </button>
          </div>
        </InlineStack>

        {/* Plan cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          <PlanCard
            title="Free"
            subtitle="Perfect to get started."
            amount="$0"
            suffix="/month"
            features={FREE_FEATURES}
            selected={!isPremium}
            ctaLabel="Selected"
            ctaDisabled
          />
          <PlanCard
            title="Premium"
            subtitle="For stores that want full growth tools."
            amount={premiumPricing.amount}
            suffix={premiumPricing.suffix}
            note={premiumPricing.note}
            features={PREMIUM_FEATURES}
            selected={isPremium}
            ctaLabel={isPremium ? "Current Plan" : "Start premium"}
            ctaDisabled={isPremium}
            loading={isSubmitting && !isPremium}
            onSelect={handleSelectPremium}
          />
        </div>
      </BlockStack>
    </Page>
  );
}

function PlanCard({
  title,
  subtitle,
  amount,
  suffix,
  note,
  features,
  selected,
  ctaLabel,
  ctaDisabled = false,
  loading = false,
  onSelect,
}) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="200" blockAlign="center">
          <Text as="h2" variant="headingMd" fontWeight="bold">
            {title}
          </Text>
          {selected && (
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#aee9c0",
                color: "#0f5132",
              }}
            >
              Selected
            </span>
          )}
        </InlineStack>

        <Text as="p" tone="subdued">
          {subtitle}
        </Text>

        <InlineStack gap="100" blockAlign="end">
          <Text as="p" variant="heading2xl" fontWeight="bold">
            {amount}
          </Text>
          <Text as="p" tone="subdued">
            {suffix}
          </Text>
        </InlineStack>

        {note && (
          <Text as="p" tone="subdued" variant="bodySm">
            {note}
          </Text>
        )}

        <BlockStack gap="200">
          {features.map((feature) => (
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

        <div style={{ marginTop: "8px" }}>
          <Button
            fullWidth
            variant={selected ? "secondary" : "primary"}
            disabled={ctaDisabled}
            loading={loading}
            onClick={onSelect}
          >
            {ctaLabel}
          </Button>
        </div>
      </BlockStack>
    </Card>
  );
}
