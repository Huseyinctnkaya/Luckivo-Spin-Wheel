import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisFixes from "../styles/polaris-fixes.css?url";
import { authenticate, PLANS } from "../shopify.server";

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
  const storeName = session.shop.replace(".myshopify.com", "");
  const returnUrl = `https://admin.shopify.com/store/${storeName}/apps/${process.env.SHOPIFY_API_KEY}`;

  await billing.require({
    plans: [PLANS.PREMIUM_MONTHLY],
    isTest,
    onFailure: async () =>
      billing.request({
        plan: PLANS.PREMIUM_MONTHLY,
        isTest,
        returnUrl,
      }),
  });

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
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
