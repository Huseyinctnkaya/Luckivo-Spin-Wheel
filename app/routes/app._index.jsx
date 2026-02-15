import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Icon,
  Popover,
  ActionList,
} from "@shopify/polaris";
import { CalendarIcon, ChevronRightIcon, ChevronLeftIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useCallback } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const days = parseInt(url.searchParams.get("days") || "7", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  // Calculate date range based on days + offset
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - (offset * days));
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const dateFilter = {
    gte: startDate,
    lte: endDate,
  };

  // Format dates for display
  const formatDate = (d) => {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const dateRangeLabel = `${formatDate(startDate)} - ${formatDate(endDate)}`;

  try {
    if (!db.impression) {
      return json({
        totalImpressions: 0,
        totalSpins: 0,
        emailsCollected: 0,
        conversionRate: 0,
        days,
        offset,
        dateRangeLabel,
        error: "Prisma client out of sync",
      });
    }

    const [totalImpressions, totalSpins, emailsCollected] = await Promise.all([
      db.impression.count({
        where: {
          shop: session.shop,
          createdAt: dateFilter,
        },
      }),
      db.spin.count({
        where: {
          wheel: { shop: session.shop },
          createdAt: dateFilter,
        },
      }),
      db.spin.count({
        where: {
          wheel: { shop: session.shop },
          createdAt: dateFilter,
          customerEmail: { not: null },
        },
      }),
    ]);

    const conversionRate =
      totalImpressions > 0
        ? ((totalSpins / totalImpressions) * 100).toFixed(1)
        : 0;

    return json({
      totalImpressions,
      totalSpins,
      emailsCollected,
      conversionRate,
      days,
      offset,
      dateRangeLabel,
    });
  } catch (error) {
    console.error("Dashboard Loader Error:", error);
    return json({
      totalImpressions: 0,
      totalSpins: 0,
      emailsCollected: 0,
      conversionRate: 0,
      days,
      offset,
      dateRangeLabel,
      error: "Database error",
    });
  }
};

export default function Index() {
  const {
    totalImpressions,
    totalSpins,
    emailsCollected,
    conversionRate,
    days,
    offset,
    dateRangeLabel,
  } = useLoaderData();

  const [, setSearchParams] = useSearchParams();
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const toggleDatePicker = useCallback(
    () => setDatePickerOpen((v) => !v),
    [],
  );

  const navigate = (newDays, newOffset) => {
    const params = new URLSearchParams();
    params.set("days", String(newDays));
    params.set("offset", String(newOffset));
    setSearchParams(params);
  };

  const handleDaysChange = (newDays) => {
    navigate(newDays, 0);
    setDatePickerOpen(false);
  };

  const handlePrev = () => navigate(days, offset + 1);
  const handleNext = () => {
    if (offset > 0) navigate(days, offset - 1);
  };

  const dayOptions = [
    { content: "7 days", onAction: () => handleDaysChange(7), active: days === 7 },
    { content: "14 days", onAction: () => handleDaysChange(14), active: days === 14 },
    { content: "30 days", onAction: () => handleDaysChange(30), active: days === 30 },
    { content: "90 days", onAction: () => handleDaysChange(90), active: days === 90 },
  ];

  const titleStyle = {
    borderBottom: "1px dotted #8c9196",
    cursor: "help",
  };

  const stats = [
    { label: "Popups Displayed", value: totalImpressions },
    { label: "Forms Submitted", value: totalSpins },
    { label: "Emails Collected", value: emailsCollected },
    { label: "Conversions", value: conversionRate },
  ];

  return (
    <Page title="Lucky Wheel Dashboard">
      <BlockStack gap="500">
        {/* Stats Bar */}
        <div
          style={{
            background: "var(--p-color-bg-surface)",
            border: "1px solid #e3e3e3",
            borderRadius: "12px",
            display: "flex",
            alignItems: "stretch",
            overflow: "hidden",
          }}
        >
          {/* Date Picker */}
          <div
            style={{
              padding: "16px 20px",
              borderRight: "1px solid #e3e3e3",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Popover
              active={datePickerOpen}
              activator={
                <div
                  onClick={toggleDatePicker}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Icon source={CalendarIcon} tone="base" />
                  <Text variant="bodyMd" fontWeight="semibold">
                    {offset > 0 ? dateRangeLabel : `${days} days`}
                  </Text>
                </div>
              }
              onClose={toggleDatePicker}
              preferredAlignment="left"
            >
              <ActionList items={dayOptions} />
            </Popover>
          </div>

          {/* Stat Cells */}
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: "16px 20px",
                borderRight: "1px solid #e3e3e3",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <Text variant="bodySm" fontWeight="semibold" tone="subdued">
                <span style={titleStyle}>{stat.label}</span>
              </Text>
              <div style={{ marginTop: "4px" }}>
                <Text variant="headingLg" as="p" fontWeight="bold" tone="success">
                  {stat.value}
                </Text>
              </div>
            </div>
          ))}

          {/* Arrow Navigation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              paddingRight: "12px",
              paddingLeft: "4px",
            }}
          >
            <div
              style={{
                border: "1px solid #e3e3e3",
                borderRadius: "8px",
                display: "flex",
                overflow: "hidden",
              }}
            >
              <div
                onClick={handlePrev}
                style={{
                  cursor: "pointer",
                  padding: "6px 8px",
                  borderRight: "1px solid #e3e3e3",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Icon source={ChevronLeftIcon} tone="base" />
              </div>
              <div
                onClick={offset > 0 ? handleNext : undefined}
                style={{
                  cursor: offset > 0 ? "pointer" : "default",
                  padding: "6px 8px",
                  display: "flex",
                  alignItems: "center",
                  opacity: offset > 0 ? 1 : 0.4,
                }}
              >
                <Icon source={ChevronRightIcon} tone="base" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Getting Started
                </Text>
                <Text variant="bodyMd" as="p">
                  Your lucky wheel is ready to collect emails and boost
                  conversions.
                </Text>
                <InlineStack gap="300">
                  <Button variant="primary" url="/app/wheels">
                    Manage Your Wheels
                  </Button>
                  <Button url="/app/wheels/new">Create a New Wheel</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Support
                </Text>
                <Text variant="bodyMd" as="p">
                  Need help setting up your wheel triggers? Check our
                  documentation.
                </Text>
                <Button variant="plain">Read Documentation</Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
