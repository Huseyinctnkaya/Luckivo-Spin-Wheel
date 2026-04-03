import { json } from "@remix-run/node";
import { useLoaderData, useRouteLoaderData, useSearchParams, Link } from "@remix-run/react";
import {
  Page,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Icon,
  Popover,
  ActionList,
  Badge,
  Tooltip,
} from "@shopify/polaris";
import {
  CalendarIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EmailIcon,
  NoteIcon,
  AlertTriangleIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useCallback, useRef, useEffect } from "react";

async function checkAppEmbedEnabled(admin) {
  const EXTENSION_UID = "cf1449e6-459b-e542-07bc-86519a150ef9e95a1f96";
  const EXTENSION_HANDLE = "lucky-wheel-extension";
  const EMBED_BLOCK_HANDLE = "lucky_wheel";
  const CLIENT_ID = process.env.SHOPIFY_API_KEY || "";

  const stripSettingsComments = (rawContent) => {
    if (typeof rawContent !== "string") return "";

    // Shopify may prepend UTF-8 BOM and one/more leading block comments.
    let content = rawContent.replace(/^\uFEFF/, "").trimStart();
    while (content.startsWith("/*")) {
      const commentEnd = content.indexOf("*/");
      if (commentEnd === -1) break;
      content = content.substring(commentEnd + 2).trimStart();
    }
    return content;
  };

  const isOurEmbedBlockType = (blockType) => {
    if (typeof blockType !== "string") return false;
    const normalized = blockType.toLowerCase();
    const normalizedClientId = CLIENT_ID.toLowerCase();

    const blockHandleMatch =
      normalized.includes(`/blocks/${EMBED_BLOCK_HANDLE}/`) ||
      normalized.endsWith(`/blocks/${EMBED_BLOCK_HANDLE}`) ||
      normalized.includes("/blocks/lucky-wheel/") ||
      normalized.endsWith("/blocks/lucky-wheel");

    const appIdentityMatch =
      normalized.includes(EXTENSION_UID.toLowerCase()) ||
      normalized.includes(EXTENSION_HANDLE) ||
      (normalizedClientId && normalized.includes(normalizedClientId));

    return blockHandleMatch || appIdentityMatch;
  };

  try {
    const response = await admin.graphql(`
      {
        themes(first: 20) {
          nodes {
            files(filenames: ["config/settings_data.json"]) {
              nodes {
                body {
                  ... on OnlineStoreThemeFileBodyText {
                    content
                  }
                }
              }
            }
          }
        }
      }
    `);
    const data = await response.json();

    if (data?.errors) {
      console.error("[checkAppEmbedEnabled] GraphQL errors:", JSON.stringify(data.errors));
      return false;
    }

    const themes = data?.data?.themes?.nodes || [];

    for (const theme of themes) {
      const content = theme?.files?.nodes?.[0]?.body?.content;
      if (!content) continue;

      const jsonContent = stripSettingsComments(content);

      let settings;
      try {
        settings = JSON.parse(jsonContent);
      } catch {
        continue;
      }

      const blocks = settings?.current?.blocks || {};
      for (const block of Object.values(blocks)) {
        if (typeof block.type !== "string") continue;
        const isOurExtension = isOurEmbedBlockType(block.type);
        if (isOurExtension && block.disabled !== true) {
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    console.error("[checkAppEmbedEnabled] Error:", err);
    return false;
  }
}

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const themeEditorUrl = new URL(`https://${session.shop}/admin/themes/current/editor`);
  themeEditorUrl.searchParams.set("context", "apps");
  themeEditorUrl.searchParams.set("template", "index");
  if (process.env.SHOPIFY_API_KEY) {
    themeEditorUrl.searchParams.set(
      "activateAppId",
      `${process.env.SHOPIFY_API_KEY}/lucky_wheel`,
    );
  }

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
    const [totalImpressions, totalSpins, emailsCollected, totalWheels, activeWheels, appEnabled] =
      await Promise.all([
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
        db.wheel.count({ where: { shop: session.shop } }),
        db.wheel.count({ where: { shop: session.shop, isActive: true } }),
        checkAppEmbedEnabled(admin),
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
      setup: {
        appEnabled,
        hasCampaign: totalWheels > 0,
        hasActiveCampaign: activeWheels > 0,
        enableUrl: themeEditorUrl.toString(),
      },
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
      setup: {
        appEnabled: false,
        hasCampaign: false,
        hasActiveCampaign: false,
        enableUrl: themeEditorUrl.toString(),
      },
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
    setup,
  } = useLoaderData();

  const { isPaid, trialDaysRemaining, trialExpired } = useRouteLoaderData("routes/app") ?? {};

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
    { label: "Conversions", value: conversionRate, tooltip: "Percentage of popups that resulted in a spin." },
  ];

  return (
    <Page title="Luckivo - Spin Wheel Dashboard">
      <BlockStack gap="500">
        {/* Trial Banner */}
        {!isPaid && trialExpired && (
          <div
            style={{
              background: "#fff4e5",
              border: "1px solid #f59e0b",
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Icon source={AlertTriangleIcon} tone="caution" />
              <div>
                <Text variant="bodyMd" fontWeight="semibold">
                  Your free trial has ended
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Upgrade to Premium to keep using Luckivo Spin Wheel.
                </Text>
              </div>
            </div>
            <Link to="/app/plans" style={{ textDecoration: "none", flexShrink: 0 }}>
              <Button variant="primary" size="slim">Upgrade now — $3.99/mo</Button>
            </Link>
          </div>
        )}
        {!isPaid && !trialExpired && trialDaysRemaining > 0 && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Text variant="bodyMd" fontWeight="semibold">
                {trialDaysRemaining === 1
                  ? "Your free trial ends tomorrow"
                  : `${trialDaysRemaining} days left in your free trial`}
              </Text>
            </div>
            <Link to="/app/plans" style={{ textDecoration: "none", flexShrink: 0 }}>
              <Button variant="plain" size="slim">View plans</Button>
            </Link>
          </div>
        )}
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

        {/* Setup Guide */}
        <SetupGuide setup={setup} />

        {/* Quick Access Cards */}
        <InlineStack gap="400" align="start" wrap={false}>
          {[
            {
              title: "Wheels",
              description: "Create, manage or schedule your wheels.",
              button: "View wheels",
              url: "/app/wheels",
            },
            {
              title: "Subscribers",
              description: "View and manage your subscribers who signed up for the spin wheel.",
              button: "View subscribers",
              url: "/app/subscribers",
            },
            {
              title: "Analytics",
              description: "View your campaign performance and conversions.",
              button: "View analytics",
              url: "/app/analytics",
            },
          ].map((card) => (
            <div
              key={card.title}
              style={{
                flex: 1,
                background: "var(--p-color-bg-surface)",
                border: "1px solid #e3e3e3",
                borderRadius: "12px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "140px",
              }}
            >
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3" fontWeight="bold">
                  {card.title}
                </Text>
                <Text variant="bodyMd" tone="subdued">
                  {card.description}
                </Text>
              </BlockStack>
              <div style={{ marginTop: "16px" }}>
                <Link to={card.url} style={{ textDecoration: "none" }}>
                  <Button variant="primary">{card.button}</Button>
                </Link>
              </div>
            </div>
          ))}
        </InlineStack>

        {/* Bottom Cards */}
        <InlineStack gap="400" align="start" wrap={false}>
          <div
            style={{
              flex: 1,
              background: "var(--p-color-bg-surface)",
              border: "1px solid #e3e3e3",
              borderRadius: "12px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "140px",
            }}
          >
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3" fontWeight="bold">
                Custom Code
              </Text>
              <Text variant="bodyMd" tone="subdued">
                Add custom CSS or JavaScript to your spin wheel to match your brand perfectly.
              </Text>
            </BlockStack>
            <div style={{ marginTop: "16px" }}>
              <Link to="/app/custom-code" style={{ textDecoration: "none" }}>
                <Button variant="primary">Manage Custom Code</Button>
              </Link>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              background: "var(--p-color-bg-surface)",
              border: "1px solid #e3e3e3",
              borderRadius: "12px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "140px",
            }}
          >
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3" fontWeight="bold">
                Import & Export
              </Text>
              <Text variant="bodyMd" tone="subdued">
                Backup your campaigns and settings, or transfer them to another store.
              </Text>
            </BlockStack>
            <div style={{ marginTop: "16px" }}>
              <Link to="/app/import-export" style={{ textDecoration: "none" }}>
                <Button variant="primary">Import/Export Settings</Button>
              </Link>
            </div>
          </div>
        </InlineStack>

        {/* Help & Support */}
        <style>{`.help-support-section .Polaris-Icon { margin: 0; }`}</style>
        <div
          className="help-support-section"
          style={{
            background: "var(--p-color-bg-surface)",
            border: "1px solid #e3e3e3",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <Text variant="headingMd" as="h3" fontWeight="bold">
            Need help or customization?
          </Text>
          <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
            <a
              href="https://landing.luckivo.app/contact"
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  flex: 1,
                  background: "#f6f6f7",
                  borderRadius: "10px",
                  padding: "16px",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Icon source={EmailIcon} tone="base" />
                  <Text variant="headingSm" as="h4" fontWeight="semibold">
                    Email Support
                  </Text>
                </div>
                <div style={{ marginTop: "4px" }}>
                  <Text variant="bodyMd" tone="subdued">
                    Send us an email and we'll get back to you as soon as possible.
                  </Text>
                </div>
              </div>
            </a>
            <a
              href="https://landing.luckivo.app/docs"
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  flex: 1,
                  background: "#f6f6f7",
                  borderRadius: "10px",
                  padding: "16px",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Icon source={NoteIcon} tone="base" />
                  <Text variant="headingSm" as="h4" fontWeight="semibold">
                    Documentation
                  </Text>
                </div>
                <div style={{ marginTop: "4px" }}>
                  <Text variant="bodyMd" tone="subdued">
                    Find solutions with our docs and tutorials.
                  </Text>
                </div>
              </div>
            </a>
          </div>
        </div>
        <div style={{ height: "24px" }} />
      </BlockStack>
    </Page>
  );
}

function SetupGuide({ setup }) {
  const completedCount = [setup.appEnabled, setup.hasCampaign, setup.hasActiveCampaign].filter(Boolean).length;
  const [expanded, setExpanded] = useState(completedCount < 3);
  const [activeStep, setActiveStep] = useState(
    !setup.appEnabled ? 0 : !setup.hasCampaign ? 1 : !setup.hasActiveCampaign ? 2 : 0,
  );

  const steps = [
    {
      title: "Enable the app",
      description: "Enable the app to start using the spin wheel popup.",
      completed: setup.appEnabled,
      action: { label: "Enable", url: setup.enableUrl },
      secondaryAction: { label: "Refresh", url: "." },
    },
    {
      title: "Create your first campaign",
      description: "Set up a spin wheel with custom segments and prizes.",
      completed: setup.hasCampaign,
      action: { label: "Create campaign", url: "/app/wheels/new" },
    },
    {
      title: "Activate your campaign",
      description: "Publish your wheel so customers can start spinning.",
      completed: setup.hasActiveCampaign,
      action: { label: "Go to campaigns", url: "/app/wheels" },
    },
  ];

  return (
    <div
      style={{
        background: "var(--p-color-bg-surface)",
        border: "1px solid #e3e3e3",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <InlineStack gap="300" blockAlign="center">
          <Text variant="headingMd" as="h2" fontWeight="bold">
            Setup Guide
          </Text>
          <Badge tone={completedCount === 3 ? "success" : undefined}>
            {completedCount} / 3 completed
          </Badge>
        </InlineStack>
        <div style={{ display: "flex" }}>
          <Icon source={expanded ? ChevronUpIcon : ChevronDownIcon} tone="base" />
        </div>
      </div>

      <Collapsible open={expanded}>
        <div style={{ padding: "0 20px 12px" }}>
          <Text variant="bodyMd" tone="subdued">
            Use this personalized guide to get your app up and running.
          </Text>
        </div>

        <div style={{ borderTop: "1px solid #f1f1f1" }}>
          {steps.map((step, i) => (
            <SetupStep
              key={step.title}
              step={step}
              index={i}
              isActive={activeStep === i}
              onToggle={() => setActiveStep(activeStep === i ? -1 : i)}
            />
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

function SetupStep({ step, isActive, onToggle }) {
  const isExternal = (url) => typeof url === "string" && /^https?:\/\//.test(url);

  return (
    <div style={{ borderTop: "1px solid #f1f1f1" }}>
      <div
        onClick={onToggle}
        style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            border: step.completed ? "none" : "2px dashed #8c9196",
            background: step.completed ? "#303030" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {step.completed && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <Text variant="bodyMd" fontWeight={isActive ? "semibold" : "regular"}>
          {step.title}
        </Text>
      </div>

      <Collapsible open={isActive}>
        <div style={{ padding: "0 20px 16px 52px" }}>
          {step.completed ? (
            <Text variant="bodyMd" tone="success">
              Completed
            </Text>
          ) : (
            <BlockStack gap="300">
              <Text variant="bodyMd" tone="subdued">
                {step.description}
              </Text>
              <InlineStack gap="300" blockAlign="center">
                {step.action.url ? (
                  isExternal(step.action.url) ? (
                    <Button variant="primary" url={step.action.url} target="_top">
                      {step.action.label}
                    </Button>
                  ) : (
                    <Link to={step.action.url} style={{ textDecoration: "none" }}>
                      <Button variant="primary">{step.action.label}</Button>
                    </Link>
                  )
                ) : (
                  <Button variant="primary">{step.action.label}</Button>
                )}
                {step.secondaryAction && (
                  isExternal(step.secondaryAction.url) ? (
                    <Button variant="plain" url={step.secondaryAction.url} target="_top">
                      {step.secondaryAction.label}
                    </Button>
                  ) : (
                    <Link to={step.secondaryAction.url} style={{ textDecoration: "none" }}>
                      <Button variant="plain">{step.secondaryAction.label}</Button>
                    </Link>
                  )
                )}
              </InlineStack>
            </BlockStack>
          )}
        </div>
      </Collapsible>
    </div>
  );
}

function Collapsible({ open, children }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(open ? "auto" : "0px");
  const [visible, setVisible] = useState(open);
  const initial = useRef(true);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;

    if (open) {
      setVisible(true);
      el.style.height = "0px";
      requestAnimationFrame(() => {
        setHeight(`${el.scrollHeight}px`);
        const done = () => {
          setHeight("auto");
          el.removeEventListener("transitionend", done);
        };
        el.addEventListener("transitionend", done);
      });
    } else {
      setHeight(`${el.scrollHeight}px`);
      requestAnimationFrame(() => {
        setHeight("0px");
        const done = () => {
          setVisible(false);
          el.removeEventListener("transitionend", done);
        };
        el.addEventListener("transitionend", done);
      });
    }
  }, [open]);

  return (
    <div
      ref={ref}
      style={{
        height,
        overflow: "hidden",
        transition: "height 250ms ease",
        visibility: visible || open ? "visible" : "hidden",
      }}
    >
      {children}
    </div>
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
