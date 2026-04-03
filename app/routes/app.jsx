import { json, redirect } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisFixes from "../styles/polaris-fixes.css?url";
import { authenticate, PLANS } from "../shopify.server";
import db from "../db.server";

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
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/wheels">Wheels</Link>
        <Link to="/app/subscribers">Subscribers</Link>
        <Link to="/app/email-settings">Email</Link>
        <Link to="/app/analytics">Analytics</Link>
        <Link to="/app/plans">Plans</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
