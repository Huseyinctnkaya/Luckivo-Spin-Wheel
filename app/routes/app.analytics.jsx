import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  IndexTable,
  DataTable,
  Badge,
  EmptyState,
  Icon,
  Popover,
  ActionList,
  Tooltip,
  Box,
} from "@shopify/polaris";
import {
  CalendarIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useCallback } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const days = parseInt(url.searchParams.get("days") || "7", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - offset * days);
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const dateFilter = { gte: startDate, lte: endDate };

  const formatDate = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dateRangeLabel = `${formatDate(startDate)} - ${formatDate(endDate)}`;

  try {
    const [
      totalImpressions,
      totalSpins,
      emailsCollected,
      wheels,
      prizeDistribution,
      recentSpins,
    ] = await Promise.all([
      db.impression.count({
        where: { shop: session.shop, createdAt: dateFilter },
      }),
      db.spin.count({
        where: { wheel: { shop: session.shop }, createdAt: dateFilter },
      }),
      db.spin.count({
        where: {
          wheel: { shop: session.shop },
          createdAt: dateFilter,
          customerEmail: { not: null },
        },
      }),
      db.wheel.findMany({
        where: { shop: session.shop },
        select: {
          id: true,
          title: true,
          isActive: true,
          _count: {
            select: {
              impressions: { where: { createdAt: dateFilter } },
              spins: { where: { createdAt: dateFilter } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.spin.groupBy({
        by: ["result"],
        where: { wheel: { shop: session.shop }, createdAt: dateFilter },
        _count: { result: true },
        orderBy: { _count: { result: "desc" } },
      }),
      db.spin.findMany({
        where: { wheel: { shop: session.shop }, createdAt: dateFilter },
        include: { wheel: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const conversionRate =
      totalImpressions > 0
        ? ((totalSpins / totalImpressions) * 100).toFixed(1)
        : "0";

    const wheelPerformance = wheels.map((w) => ({
      id: w.id,
      title: w.title,
      isActive: w.isActive,
      impressions: w._count.impressions,
      spins: w._count.spins,
      conversionRate:
        w._count.impressions > 0
          ? ((w._count.spins / w._count.impressions) * 100).toFixed(1)
          : "0",
    }));

    const totalPrizeSpins = prizeDistribution.reduce(
      (acc, p) => acc + p._count.result,
      0,
    );
    const prizes = prizeDistribution.map((p) => ({
      prize: p.result,
      count: p._count.result,
      percentage:
        totalPrizeSpins > 0
          ? ((p._count.result / totalPrizeSpins) * 100).toFixed(1)
          : "0",
    }));

    return json({
      totalImpressions,
      totalSpins,
      emailsCollected,
      conversionRate,
      wheelPerformance,
      prizes,
      recentSpins: recentSpins.map((s) => ({
        id: s.id,
        wheelTitle: s.wheel.title,
        customerEmail: s.customerEmail || "Anonymous",
        result: s.result,
        couponCode: s.couponCode || "-",
        createdAt: s.createdAt,
      })),
      days,
      offset,
      dateRangeLabel,
    });
  } catch (error) {
    console.error("Analytics Loader Error:", error);
    return json({
      totalImpressions: 0,
      totalSpins: 0,
      emailsCollected: 0,
      conversionRate: "0",
      wheelPerformance: [],
      prizes: [],
      recentSpins: [],
      days,
      offset,
      dateRangeLabel,
    });
  }
};

export default function AnalyticsPage() {
  const {
    totalImpressions,
    totalSpins,
    emailsCollected,
    conversionRate,
    wheelPerformance,
    prizes,
    recentSpins,
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

  const updateParams = (newDays, newOffset) => {
    const params = new URLSearchParams();
    params.set("days", String(newDays));
    params.set("offset", String(newOffset));
    setSearchParams(params);
  };

  const handleDaysChange = (newDays) => {
    updateParams(newDays, 0);
    setDatePickerOpen(false);
  };

  const handlePrev = () => updateParams(days, offset + 1);
  const handleNext = () => {
    if (offset > 0) updateParams(days, offset - 1);
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
    { label: "Popups Displayed", value: totalImpressions, tooltip: "Number of times the spin wheel popup was shown." },
    { label: "Forms Submitted", value: totalSpins, tooltip: "Number of wheel spins completed by visitors." },
    { label: "Emails Collected", value: emailsCollected, tooltip: "Number of emails collected from visitors." },
    { label: "Conversions", value: `${conversionRate}%`, tooltip: "Percentage of popups that resulted in a spin." },
  ];

  return (
    <Page title="Analytics" backAction={{ url: "/app" }}>
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

          {stats.map((stat) => (
            <StatCell key={stat.label} stat={stat} titleStyle={titleStyle} />
          ))}

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

        {/* Campaign Performance */}
        {wheelPerformance.length === 0 ? (
          <Card>
            <EmptyState
              heading="No campaigns yet"
              action={{ content: "Create Wheel", url: "/app/wheels/new" }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Create a wheel to start tracking performance.</p>
            </EmptyState>
          </Card>
        ) : (
          <Card padding="0">
            <Box padding="400" paddingBlockEnd="200">
              <Text variant="headingMd" as="h2" fontWeight="bold">
                Campaign Performance
              </Text>
            </Box>
            <IndexTable
              resourceName={{ singular: "campaign", plural: "campaigns" }}
              itemCount={wheelPerformance.length}
              headings={[
                { title: "Campaign" },
                { title: "Status" },
                { title: "Impressions", alignment: "end" },
                { title: "Spins", alignment: "end" },
                { title: "Conversion Rate", alignment: "end" },
              ]}
              selectable={false}
            >
              {wheelPerformance.map((wheel, index) => (
                <IndexTable.Row id={wheel.id} key={wheel.id} position={index}>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" fontWeight="bold" as="span">
                      {wheel.title}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {wheel.isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="attention">Draft</Badge>
                    )}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" alignment="end" variant="bodyMd">
                      {wheel.impressions}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" alignment="end" variant="bodyMd">
                      {wheel.spins}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" alignment="end" variant="bodyMd">
                      {wheel.conversionRate}%
                    </Text>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        )}

        {/* Prize Distribution */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" fontWeight="bold">
              Prize Distribution
            </Text>
            {prizes.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "numeric", "numeric"]}
                headings={["Prize", "Times Won", "Percentage"]}
                rows={prizes.map((p) => [p.prize, p.count, `${p.percentage}%`])}
                totals={["", totalSpins, "100%"]}
                showTotalsInFooter
              />
            ) : (
              <Text tone="subdued">No spin data for this period.</Text>
            )}
          </BlockStack>
        </Card>

        {/* Recent Activity */}
        {recentSpins.length > 0 && (
          <Card padding="0">
            <Box padding="400" paddingBlockEnd="200">
              <Text variant="headingMd" as="h2" fontWeight="bold">
                Recent Activity
              </Text>
            </Box>
            <IndexTable
              resourceName={{ singular: "spin", plural: "spins" }}
              itemCount={recentSpins.length}
              headings={[
                { title: "Campaign" },
                { title: "Email" },
                { title: "Prize Won" },
                { title: "Coupon Code" },
                { title: "Date" },
              ]}
              selectable={false}
            >
              {recentSpins.map((spin, index) => (
                <IndexTable.Row id={spin.id} key={spin.id} position={index}>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" as="span">
                      {spin.wheelTitle}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" as="span">
                      {spin.customerEmail}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge>{spin.result}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" as="span" tone="subdued">
                      {spin.couponCode}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" as="span">
                      {new Date(spin.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        )}

        <div style={{ height: "24px" }} />
      </BlockStack>
    </Page>
  );
}

function StatCell({ stat, titleStyle }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "16px 20px",
        borderRight: "1px solid #e3e3e3",
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        background: hovered ? "#f6f6f7" : "transparent",
        transition: "background 150ms ease",
        cursor: "default",
      }}
    >
      <Tooltip content={stat.tooltip}>
        <Text variant="bodySm" fontWeight="semibold" tone="subdued">
          <span style={titleStyle}>{stat.label}</span>
        </Text>
      </Tooltip>
      <div style={{ marginTop: "4px" }}>
        <Text variant="headingLg" as="p" fontWeight="bold" tone="success">
          {stat.value}
        </Text>
      </div>
    </div>
  );
}
