import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  DataTable,
  Badge,
  EmptyState,
  Icon,
  Popover,
  ActionList,
  Tooltip,
} from "@shopify/polaris";
import {
  CalendarIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useCallback } from "react";
import { useLanguage } from "../i18n/LanguageContext";

function computeDelta(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

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

  // Previous period (same length, immediately before current)
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  prevStart.setHours(0, 0, 0, 0);
  const prevFilter = { gte: prevStart, lte: prevEnd };

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
      prevImpressions,
      prevSpins,
      prevEmails,
      allSpinDates,
      allImpressionDates,
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
      // Previous period counts for delta
      db.impression.count({
        where: { shop: session.shop, createdAt: prevFilter },
      }),
      db.spin.count({
        where: { wheel: { shop: session.shop }, createdAt: prevFilter },
      }),
      db.spin.count({
        where: {
          wheel: { shop: session.shop },
          createdAt: prevFilter,
          customerEmail: { not: null },
        },
      }),
      // Daily breakdown for chart
      db.spin.findMany({
        where: { wheel: { shop: session.shop }, createdAt: dateFilter },
        select: { createdAt: true },
      }),
      db.impression.findMany({
        where: { shop: session.shop, createdAt: dateFilter },
        select: { createdAt: true },
      }),
    ]);

    const conversionRate =
      totalImpressions > 0
        ? ((totalSpins / totalImpressions) * 100).toFixed(1)
        : "0";

    const prevConversionNum =
      prevImpressions > 0 ? (prevSpins / prevImpressions) * 100 : 0;
    const currConversionNum =
      totalImpressions > 0 ? (totalSpins / totalImpressions) * 100 : 0;
    const conversionDelta = Math.round(currConversionNum - prevConversionNum);

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

    // Build daily chart data — one entry per day in the range
    const dayMap = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dayMap[key] = { date: label, impressions: 0, spins: 0 };
    }
    allSpinDates.forEach((s) => {
      const key = new Date(s.createdAt).toISOString().slice(0, 10);
      if (dayMap[key]) dayMap[key].spins++;
    });
    allImpressionDates.forEach((imp) => {
      const key = new Date(imp.createdAt).toISOString().slice(0, 10);
      if (dayMap[key]) dayMap[key].impressions++;
    });
    const dailyData = Object.values(dayMap);

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
      deltas: {
        impressions: computeDelta(totalImpressions, prevImpressions),
        spins: computeDelta(totalSpins, prevSpins),
        emails: computeDelta(emailsCollected, prevEmails),
        conversion: conversionDelta,
      },
      dailyData,
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
      deltas: { impressions: 0, spins: 0, emails: 0, conversion: 0 },
      dailyData: [],
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
    deltas,
    dailyData,
  } = useLoaderData();

  const [, setSearchParams] = useSearchParams();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { t } = useLanguage();

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
    { content: t("dashboard_7days"), onAction: () => handleDaysChange(7), active: days === 7 },
    { content: t("dashboard_14days"), onAction: () => handleDaysChange(14), active: days === 14 },
    { content: t("dashboard_30days"), onAction: () => handleDaysChange(30), active: days === 30 },
    { content: t("dashboard_90days"), onAction: () => handleDaysChange(90), active: days === 90 },
  ];

  const titleStyle = {
    borderBottom: "1px dotted #8c9196",
    cursor: "help",
  };

  const stats = [
    { label: t("analytics_stat_popups"), value: totalImpressions, tooltip: t("dashboard_tooltip_popups"), delta: deltas.impressions },
    { label: t("analytics_stat_forms"), value: totalSpins, tooltip: t("dashboard_tooltip_forms"), delta: deltas.spins },
    { label: t("analytics_stat_emails"), value: emailsCollected, tooltip: t("dashboard_tooltip_emails"), delta: deltas.emails },
    { label: t("analytics_stat_conversions"), value: `${conversionRate}%`, tooltip: t("dashboard_tooltip_conversions"), delta: deltas.conversion, isConversionDelta: true },
  ];

  return (
    <Page title={t("analytics_title")} backAction={{ url: "/app" }}>
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

        {/* Daily Trend Chart */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2" fontWeight="bold">
              {t("analytics_daily_activity")}
            </Text>
            <DailyChart data={dailyData} t={t} />
          </BlockStack>
        </Card>

        {/* Wheel Performance */}
        {wheelPerformance.length === 0 ? (
          <Card>
            <EmptyState
              heading={t("analytics_no_wheels_heading")}
              action={{ content: t("analytics_no_wheels_cta"), url: "/app/wheels/new" }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>{t("analytics_no_wheels_desc")}</p>
            </EmptyState>
          </Card>
        ) : (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2" fontWeight="bold">
                {t("analytics_wheel_performance")}
              </Text>
              <DataTable
                columnContentTypes={["text", "text", "numeric", "numeric", "numeric"]}
                headings={[t("analytics_col_wheel"), t("analytics_col_status"), t("analytics_col_impressions"), t("analytics_col_spins"), t("analytics_col_conversion")]}
                rows={wheelPerformance.map((wheel) => [
                  <Text variant="bodyMd" fontWeight="bold" as="span" key={wheel.id}>{wheel.title}</Text>,
                  wheel.isActive ? <Badge tone="success">{t("active")}</Badge> : <Badge tone="attention">{t("draft")}</Badge>,
                  wheel.impressions,
                  wheel.spins,
                  `${wheel.conversionRate}%`,
                ])}
              />
            </BlockStack>
          </Card>
        )}

        {/* Prize Distribution */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" fontWeight="bold">
              {t("analytics_prize_distribution")}
            </Text>
            {prizes.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "numeric", "numeric"]}
                headings={[t("analytics_col_prize"), t("analytics_col_times_won"), t("analytics_col_percentage")]}
                rows={prizes.map((p) => [p.prize, p.count, `${p.percentage}%`])}
                totals={["", totalSpins, "100%"]}
                showTotalsInFooter
              />
            ) : (
              <Text tone="subdued">{t("analytics_no_spin_data")}</Text>
            )}
          </BlockStack>
        </Card>

        {/* Recent Activity */}
        {recentSpins.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2" fontWeight="bold">
                {t("analytics_recent_activity")}
              </Text>
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text"]}
                headings={[t("analytics_col_wheel"), t("analytics_col_email"), t("analytics_col_prize_won"), t("analytics_col_coupon"), t("analytics_col_date")]}
                rows={recentSpins.map((spin) => [
                  spin.wheelTitle,
                  spin.customerEmail,
                  <Badge key={spin.id}>{spin.result}</Badge>,
                  spin.couponCode,
                  new Date(spin.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                ])}
              />
            </BlockStack>
          </Card>
        )}

        <div style={{ height: "24px" }} />
      </BlockStack>
    </Page>
  );
}

function StatCell({ stat, titleStyle }) {
  const [hovered, setHovered] = useState(false);
  const { delta, isConversionDelta } = stat;
  const hasData = delta !== undefined && delta !== null;
  const deltaColor = delta > 0 ? "#008060" : delta < 0 ? "#d72c0d" : "#8c9196";
  const deltaArrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  const deltaSuffix = isConversionDelta ? "pp" : "%";

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
      <div style={{ marginTop: "4px", display: "flex", alignItems: "baseline", gap: "8px" }}>
        <Text variant="headingLg" as="p" fontWeight="bold" tone="success">
          {stat.value}
        </Text>
        {hasData && (
          <Tooltip content={`vs previous ${deltaSuffix === "pp" ? "period (percentage points)" : "period"}`}>
            <span style={{ fontSize: "12px", fontWeight: "600", color: deltaColor, whiteSpace: "nowrap" }}>
              {deltaArrow} {Math.abs(delta)}{deltaSuffix}
            </span>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function DailyChart({ data, t }) {
  if (!data || data.length === 0) {
    return <Text tone="subdued">{t("analytics_no_activity")}</Text>;
  }

  const maxValue = Math.max(...data.flatMap((d) => [d.impressions, d.spins]), 1);

  const svgW = 600;
  const svgH = 180;
  const padTop = 16;
  const padRight = 12;
  const padBottom = 36;
  const padLeft = 36;
  const chartW = svgW - padLeft - padRight;
  const chartH = svgH - padTop - padBottom;

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = Math.round((maxValue / tickCount) * i);
    const y = padTop + chartH - (val / maxValue) * chartH;
    return { val, y };
  });

  const groupW = chartW / data.length;
  const barW = Math.min(Math.floor(groupW * 0.32), 18);

  // Only show every Nth label to avoid crowding
  const labelEvery = data.length <= 14 ? 1 : data.length <= 30 ? 3 : 7;

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-label="Daily activity chart"
      >
        {/* Grid lines + Y labels */}
        {ticks.map((tick) => (
          <g key={tick.val}>
            <line
              x1={padLeft} y1={tick.y}
              x2={svgW - padRight} y2={tick.y}
              stroke="#e3e3e3" strokeWidth="1"
            />
            <text
              x={padLeft - 6} y={tick.y + 4}
              textAnchor="end" fontSize="10" fill="#8c9196"
            >
              {tick.val}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const cx = padLeft + i * groupW + groupW / 2;
          const impH = (d.impressions / maxValue) * chartH;
          const spinH = (d.spins / maxValue) * chartH;
          const impX = cx - barW - 1;
          const spinX = cx + 1;

          return (
            <g key={d.date}>
              <title>{d.date}: {d.impressions} impressions, {d.spins} spins</title>
              {/* Impression bar */}
              <rect
                x={impX}
                y={padTop + chartH - impH}
                width={barW} height={impH}
                fill="#c4b5fd" rx="2"
              />
              {/* Spin bar */}
              <rect
                x={spinX}
                y={padTop + chartH - spinH}
                width={barW} height={spinH}
                fill="#6c5ce7" rx="2"
              />
              {/* X-axis label */}
              {i % labelEvery === 0 && (
                <text
                  x={cx} y={svgH - 6}
                  textAnchor="middle" fontSize="9" fill="#8c9196"
                >
                  {d.date}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "12px", height: "10px", borderRadius: "2px", background: "#c4b5fd" }} />
          <Text variant="bodySm" tone="subdued">{t("analytics_legend_impressions")}</Text>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "12px", height: "10px", borderRadius: "2px", background: "#6c5ce7" }} />
          <Text variant="bodySm" tone="subdued">{t("analytics_legend_spins")}</Text>
        </div>
      </div>
    </div>
  );
}
