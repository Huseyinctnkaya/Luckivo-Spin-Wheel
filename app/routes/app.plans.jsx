import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { authenticate } from "../shopify.server";
import { Page, Card, Text, BlockStack, InlineStack, Button } from "@shopify/polaris";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return json({ currentPlan: "free" });
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
  const [billingPeriod, setBillingPeriod] = useState("monthly");

  const premiumPricing = useMemo(() => {
    if (billingPeriod === "annual") {
      return { amount: "$39.99", suffix: "/year", note: "Billed yearly" };
    }
    return { amount: "$3.99", suffix: "/month", note: "7-day free trial included" };
  }, [billingPeriod]);

  return (
    <Page title="Plans">
      <BlockStack gap="500">
        <InlineStack>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid #c9cccf",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              style={{
                border: "none",
                background: billingPeriod === "monthly" ? "#303030" : "#ffffff",
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
              onClick={() => setBillingPeriod("annual")}
              style={{
                border: "none",
                borderLeft: "1px solid #c9cccf",
                background: billingPeriod === "annual" ? "#303030" : "#ffffff",
                color: billingPeriod === "annual" ? "#ffffff" : "#303030",
                padding: "8px 14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Annual
            </button>
          </div>
        </InlineStack>

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
            selected={currentPlan === "free"}
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
            selected={currentPlan === "premium"}
            ctaLabel={currentPlan === "premium" ? "Current Plan" : "Start premium"}
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
}) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h2" variant="headingMd" fontWeight="bold">
              {title}
            </Text>
            {selected ? (
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
            ) : null}
          </InlineStack>
        </InlineStack>

        <Text as="p" tone="subdued">
          {subtitle}
        </Text>

        <InlineStack gap="100" blockAlign="end">
          <Text as="p" variant="heading2xl" fontWeight="bold">
            <span style={{ color: "#5c3bfe" }}>{amount}</span>
          </Text>
          <Text as="p" tone="subdued">
            {suffix}
          </Text>
        </InlineStack>

        {note ? (
          <Text as="p" tone="subdued" variant="bodySm">
            {note}
          </Text>
        ) : null}

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
            disabled={ctaDisabled || selected}
          >
            {ctaLabel}
          </Button>
        </div>
      </BlockStack>
    </Card>
  );
}
