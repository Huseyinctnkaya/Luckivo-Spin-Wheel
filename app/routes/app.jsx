import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation, useRouteError } from "@remix-run/react";
import { BlockStack, Button, Card, Page, Text } from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisFixes from "../styles/polaris-fixes.css?url";
import { authenticate, PLANS } from "../shopify.server";
import db from "../db.server";
import { getTrialDaysRemaining } from "../entitlement.server";
import { LanguageProvider, useLanguage } from "../i18n/LanguageContext";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: polarisFixes },
];

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

  // Kurulum tarihini kaydet ve isPaid'i tazele: storefront proxy'si yetkiyi
  // Shopify'a sormak yerine bu kayıttan okuyor.
  const shopRecord = await db.shop.upsert({
    where: { shop: session.shop },
    create: { shop: session.shop, isPaid },
    update: { isPaid },
  });

  const trialDaysRemaining = getTrialDaysRemaining(shopRecord.installedAt);
  const trialExpired = !isPaid && trialDaysRemaining === 0;

  // Trial durumu burada yönlendirmeye çevrilmiyor: karar render katmanında
  // veriliyor (bkz. AppShell). Loader'dan redirect etmek embedded parametreleri
  // düşürüp kullanıcıyı login ekranına atıyordu.
  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    isPaid,
    trialDaysRemaining,
    trialExpired,
  });
};

export default function App() {
  const { apiKey, isPaid, trialExpired } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <LanguageProvider>
        <AppShell locked={!isPaid && trialExpired} />
      </LanguageProvider>
    </AppProvider>
  );
}

/**
 * Deneme süresi dolduğunda hangi sayfaların erişilebilir kalacağını belirler.
 *
 * @param {string} pathname - Aktif rota, örn. "/app/subscribers"
 * @returns {boolean} true → sayfa normal render edilir, false → kilit ekranı
 */
function isPathAllowedDuringLockout(pathname) {
  // Kilitlenen tek yer çark yönetimi: ürünün asıl değeri orada.
  // Merchant kendi verisine (aboneler, analiz, dışa aktarma) ve plans
  // sayfasına erişmeye devam eder — veriyi rehin almıyoruz.
  return !pathname.startsWith("/app/wheels");
}

function AppShell({ locked }) {
  const { t, lang, setLang } = useLanguage();
  const { pathname } = useLocation();
  const showLock = locked && !isPathAllowedDuringLockout(pathname);

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
      {showLock ? <TrialEndedScreen /> : <Outlet />}
    </>
  );
}

function TrialEndedScreen() {
  const { t } = useLanguage();

  return (
    <Page>
      <div style={{ maxWidth: "520px", margin: "48px auto 0" }}>
        <Card>
          <BlockStack gap="500">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "44px", lineHeight: 1, marginBottom: "12px" }}>🎡</div>
              <Text variant="headingLg" as="h2">{t("lock_title")}</Text>
            </div>

            <Text variant="bodyMd" tone="subdued" alignment="center">
              {t("lock_desc")}
            </Text>

            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: "10px",
                padding: "12px 16px",
                textAlign: "center",
              }}
            >
              <Text variant="bodySm">{t("lock_reassure")}</Text>
            </div>

            <Link to="/app/plans" style={{ textDecoration: "none" }}>
              <Button variant="primary" size="large" fullWidth>
                {t("lock_cta")}
              </Button>
            </Link>

            <Text variant="bodySm" tone="subdued" alignment="center">
              {t("lock_footnote")}
            </Text>
          </BlockStack>
        </Card>
      </div>
    </Page>
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
