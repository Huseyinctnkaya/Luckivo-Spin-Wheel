import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  InlineStack,
  Badge,
  Grid,
  Divider,
  Icon,
} from "@shopify/polaris";
import { CalendarIcon, ChevronRightIcon, ChevronLeftIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  try {
    if (!db.impression) {
      console.error("Prisma Error: db.impression is undefined.");
      return json({ totalImpressions: 0, totalSpins: 0, conversionRate: 0, error: "Prisma client out of sync" });
    }

    const totalImpressions = await db.impression.count({
      where: { shop: session.shop }
    });

    const totalSpins = await db.spin.count({
      where: { wheel: { shop: session.shop } }
    });

    const conversionRate = totalImpressions > 0
      ? ((totalSpins / totalImpressions) * 100).toFixed(1)
      : 0;

    return json({ totalImpressions, totalSpins, conversionRate });
  } catch (error) {
    console.error("Dashboard Loader Error:", error);
    return json({ totalImpressions: 0, totalSpins: 0, conversionRate: 0, error: "Database error" });
  }
};

export default function Index() {
  const { totalImpressions, totalSpins, conversionRate } = useLoaderData();

  return (
    <Page title="Lucky Wheel Dashboard">
      <BlockStack gap="500">
        {/* Stats Bar */}
        <Card padding="0">
          <InlineStack gap="0" align="stretch">
            {/* Date Selector Placeholder */}
            <Box padding="400" borderRightWidth="025" borderColor="border-subdued">
              <InlineStack gap="200" align="center">
                <Icon source={CalendarIcon} tone="base" />
                <Text variant="bodyMd" fontWeight="semibold">7 days</Text>
              </InlineStack>
            </Box>

            {/* Popups Displayed */}
            <Box padding="400" borderRightWidth="025" borderColor="border-subdued" minWidth="200px">
              <BlockStack gap="100">
                <Text variant="headingSm" as="h3" color="subdued">Popups Displayed</Text>
                <Text variant="headingLg" as="p" color="success">{totalImpressions}</Text>
              </BlockStack>
            </Box>

            {/* Forms Submitted */}
            <Box padding="400" borderRightWidth="025" borderColor="border-subdued" minWidth="200px">
              <BlockStack gap="100">
                <Text variant="headingSm" as="h3" color="subdued">Forms Submitted</Text>
                <Text variant="headingLg" as="p" color="success">{totalSpins}</Text>
              </BlockStack>
            </Box>

            {/* Emails Collected */}
            <Box padding="400" borderRightWidth="025" borderColor="border-subdued" minWidth="200px">
              <BlockStack gap="100">
                <Text variant="headingSm" as="h3" color="subdued">Emails Collected</Text>
                <Text variant="headingLg" as="p" color="success">{totalSpins}</Text>
              </BlockStack>
            </Box>

            {/* Conversions (Rate) */}
            <Box padding="400" minWidth="150px" flex="1">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3" color="subdued">Conversions</Text>
                  <Text variant="headingLg" as="p" color="success">{conversionRate}%</Text>
                </BlockStack>
                <InlineStack gap="100">
                  <Button icon={ChevronLeftIcon} variant="tertiary" size="slim" />
                  <Button icon={ChevronRightIcon} variant="tertiary" size="slim" />
                </InlineStack>
              </InlineStack>
            </Box>
          </InlineStack>
        </Card>

        {/* Action Cards */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Getting Started</Text>
                <Text variant="bodyMd" as="p">
                  Your lucky wheel is ready to collect emails and boost conversions.
                </Text>
                <InlineStack gap="300">
                  <Button variant="primary" url="/app/wheels">Manage Your Wheels</Button>
                  <Button url="/app/wheels/new">Create a New Wheel</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Support</Text>
                <Text variant="bodyMd" as="p">
                  Need help setting up your wheel triggers? Check our documentation.
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
