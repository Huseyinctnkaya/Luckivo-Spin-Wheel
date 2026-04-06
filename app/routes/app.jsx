import { json, redirect } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisFixes from "../styles/polaris-fixes.css?url";
import { authenticate, PLANS } from "../shopify.server";
import db from "../db.server";
import { LanguageProvider, useLanguage } from "../i18n/LanguageContext";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: polarisFixes },
];

const TRIAL_DAYS = 7;

const getBillingIsTest = () => {
  const value = process.env.SHOPIFY_BILLING_TEST?.toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return process.env.NODE_ENV !== "production";
};

export const loader = async ({ request }) => {
  const { billing, session } = await authenticate.admin(request);
  const isTest = getBillingIsTest();

  // Check billing status without forcing a redirect
  const billingChecks = await Promise.all(
    [isTest, !isTest].map((t) =>
      billing
        .check({ plans: [PLANS.PREMIUM_MONTHLY], isTest: t })
        .catch(() => ({ hasActivePayment: false })),
    ),
  );
  const isPaid = billingChecks.some((c) => c.hasActivePayment);

  // Ensure shop install date is tracked
  await db.shop.upsert({
    where: { shop: session.shop },
    create: { shop: session.shop },
    update: {},
  });

  const shopRecord = await db.shop.findUnique({ where: { shop: session.shop } });
  const daysSinceInstall =
    (Date.now() - shopRecord.installedAt.getTime()) / (1000 * 60 * 60 * 24);
  const trialDaysRemaining = Math.max(0, Math.ceil(TRIAL_DAYS - daysSinceInstall));
  const trialExpired = !isPaid && trialDaysRemaining === 0;

  // Trial bittiyse ve ödeme yoksa → plans sayfasına yönlendir (plans sayfası hariç)
  const url = new URL(request.url);
  if (trialExpired && !url.pathname.startsWith("/app/plans")) {
    return redirect("/app/plans");
  }

  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    isPaid,
    trialDaysRemaining,
    trialExpired,
  });
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <LanguageProvider>
        <AppShell />
      </LanguageProvider>
    </AppProvider>
  );
}

function AppShell() {
  const { t, lang, setLang } = useLanguage();

  return (
    <>
      <NavMenu>
        <Link to="/app" rel="home">{t("nav_home")}</Link>
        <Link to="/app/wheels">{t("nav_wheels")}</Link>
        <Link to="/app/subscribers">{t("nav_subscribers")}</Link>
        <Link to="/app/email-settings">{t("nav_email")}</Link>
        <Link to="/app/analytics">{t("nav_analytics")}</Link>
        <Link to="/app/plans">{t("nav_plans")}</Link>
      </NavMenu>
      <LanguageSelector lang={lang} setLang={setLang} />
      <Outlet />
    </>
  );
}

function LanguageSelector({ lang, setLang }) {
  const langs = ["tr", "en"];

  return (
    <div
      style={{
        position: "fixed",
        top: "12px",
        right: "16px",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: "var(--p-color-bg-surface)",
        border: "1px solid #e3e3e3",
        borderRadius: "8px",
        padding: "4px 6px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            padding: "2px 8px",
            borderRadius: "5px",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
            background: lang === l ? "#303030" : "transparent",
            color: lang === l ? "#ffffff" : "#6d7175",
            transition: "all 150ms ease",
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
