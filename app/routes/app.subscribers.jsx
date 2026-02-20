import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Icon,
  Popover,
  ActionList,
  Box,
  TextField,
  Button,
} from "@shopify/polaris";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@shopify/polaris-icons";
import { useCallback, useMemo, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

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
  const formatDate = (date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const [totalPopupsDisplayed, totalFormSubmissions, collectedRows, recentRows] = await Promise.all([
    db.impression.count({
      where: { shop: session.shop, createdAt: dateFilter },
    }),
    db.spin.count({
      where: { wheel: { shop: session.shop }, createdAt: dateFilter },
    }),
    db.spin.findMany({
      where: { wheel: { shop: session.shop }, createdAt: dateFilter },
      select: { customerEmail: true, customerId: true },
    }),
    db.spin.findMany({
      where: { wheel: { shop: session.shop }, createdAt: dateFilter },
      include: { wheel: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const emailOrPhoneCollected = collectedRows.filter((row) => {
    const hasEmail = typeof row.customerEmail === "string" && row.customerEmail.trim().length > 0;
    const hasCustomerId = typeof row.customerId === "string" && row.customerId.trim().length > 0;
    return hasEmail || hasCustomerId;
  }).length;

  const emailAi = new Set(
    collectedRows
      .map((row) => (typeof row.customerEmail === "string" ? row.customerEmail.trim().toLowerCase() : ""))
      .filter(Boolean),
  ).size;

  const recentSubmissions = recentRows.map((row) => ({
    id: row.id,
    campaign: row.wheel.title,
    contact: row.customerEmail || row.customerId || "Anonymous",
    reward: row.result || "-",
    code: row.couponCode || "-",
    createdAt: row.createdAt,
  }));

  return json({
    shop: session.shop,
    days,
    offset,
    dateRangeLabel: `${formatDate(startDate)} - ${formatDate(endDate)}`,
    totalFormSubmissions,
    totalPopupsDisplayed,
    emailOrPhoneCollected,
    emailAi,
    recentSubmissions,
  });
};

export default function SubscribersPage() {
  const {
    shop,
    days,
    offset,
    dateRangeLabel,
    totalFormSubmissions,
    totalPopupsDisplayed,
    emailOrPhoneCollected,
    emailAi,
    recentSubmissions,
  } = useLoaderData();

  const shopify = useAppBridge();
  const [, setSearchParams] = useSearchParams();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const toggleDatePicker = useCallback(() => setDatePickerOpen((value) => !value), []);

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

  const filteredSubmissions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return recentSubmissions;

    return recentSubmissions.filter((item) =>
      [item.contact, item.reward, item.code, item.campaign].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [query, recentSubmissions]);

  return (
    <Page
      title="Subscribers"
      subtitle={`${totalFormSubmissions} total submissions`}
      secondaryActions={[{ content: "Analytics", url: "/app/analytics" }]}
    >
      <BlockStack gap="500">
        <div
          style={{
            background: "var(--p-color-bg-surface)",
            border: "1px solid #e3e3e3",
            borderRadius: "12px",
            display: "flex",
            alignItems: "stretch",
            overflowX: "auto",
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

          <MetricCell label="Email/Phone Collected" value={emailOrPhoneCollected} />
          <MetricCell label="Total Popups Displayed" value={totalPopupsDisplayed} />
          <MetricCell label="Total Form Submissions" value={totalFormSubmissions} />
          <MetricCell label="Email AI" value={emailAi} />

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

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h2" fontWeight="bold">
                Recent Submissions
              </Text>
              <Button onClick={() => shopify.navigate(`https://${shop}/admin/customers`, { target: "_blank" })}>
                View in Shopify
              </Button>
            </InlineStack>

            <TextField
              label="Search submissions"
              labelHidden
              autoComplete="off"
              value={query}
              onChange={setQuery}
              placeholder="Search by email, phone, code, or reward..."
            />

            {recentSubmissions.length === 0 ? (
              <Box paddingBlockStart="300">
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No submissions found yet.
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Submissions will appear here once visitors spin the wheel.
                  </Text>
                </BlockStack>
              </Box>
            ) : filteredSubmissions.length === 0 ? (
              <Box paddingBlockStart="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  No results matched your search.
                </Text>
              </Box>
            ) : (
              <div
                style={{
                  border: "1px solid #e3e3e3",
                  borderRadius: "8px",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f6f6f7" }}>
                      <TableHeadCell>Contact</TableHeadCell>
                      <TableHeadCell>Campaign</TableHeadCell>
                      <TableHeadCell>Reward</TableHeadCell>
                      <TableHeadCell>Code</TableHeadCell>
                      <TableHeadCell>Date</TableHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((submission) => (
                      <tr key={submission.id} style={{ borderTop: "1px solid #f1f1f1" }}>
                        <TableCell>{submission.contact}</TableCell>
                        <TableCell>{submission.campaign}</TableCell>
                        <TableCell>{submission.reward}</TableCell>
                        <TableCell>{submission.code}</TableCell>
                        <TableCell>
                          {new Date(submission.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </BlockStack>
        </Card>
        <Box paddingBlockEnd="800" />
      </BlockStack>
    </Page>
  );
}

function MetricCell({ label, value }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: "180px",
        padding: "16px 20px",
        borderRight: "1px solid #e3e3e3",
      }}
    >
      <Text as="span" variant="bodyMd" fontWeight="semibold">
        <span style={{ borderBottom: "1px dotted #8c9196" }}>{label}</span>
      </Text>
      <div style={{ marginTop: "8px" }}>
        <Text as="p" variant="headingSm" tone="success">
          {value}
        </Text>
      </div>
    </div>
  );
}

function TableHeadCell({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 14px",
        fontSize: "13px",
        fontWeight: 600,
        color: "#303030",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({ children }) {
  return (
    <td
      style={{
        padding: "12px 14px",
        fontSize: "13px",
        color: "#303030",
      }}
    >
      {children}
    </td>
  );
}
