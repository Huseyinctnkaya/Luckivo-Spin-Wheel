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
        {/* Advanced Stats Bar (Reference: User Image) */}
        <Box
          background="bg-surface"
          borderWidth="025"
          borderColor="border"
          borderRadius="300"
          overflowX="auto"
        >
          <InlineStack gap="0" align="stretch" wrap={false}>
            {/* Date Selector */}
            <Box padding="400" borderRightWidth="025" borderColor="border-subdued" minWidth="150px">
              <InlineStack gap="200" align="center" blockAlign="center">
                <Icon source={CalendarIcon} tone="base" />
                <Text variant="bodyMd" fontWeight="semibold">7 days</Text>
              </InlineStack>
            </Box>

            {/* Popups Displayed (Selected/Highlighted) */}
            <Box
              padding="200"
              borderRightWidth="025"
              borderColor="border-subdued"
              minWidth="220px"
              flex="1"
            >
              <Box
                padding="300"
                background="bg-surface-secondary"
                borderRadius="200"
                height="100%"
              >
                <BlockStack gap="100">
                  <Text variant="bodySm" fontWeight="semibold" color="subdued">Popups Displayed</Text>
                  <Text variant="headingLg" as="p" fontWeight="bold" color="success">{totalImpressions}</Text>
                </BlockStack>
              </Box>
            </Box>

            {/* Forms Submitted */}
            <Box
              padding="400"
              borderRightWidth="025"
              borderColor="border-subdued"
              minWidth="180px"
              flex="1"
            >
              <BlockStack gap="100">
                <Text variant="bodySm" fontWeight="semibold" color="subdued">Forms Submitted</Text>
                <Text variant="headingLg" as="p" fontWeight="bold" color="success">{totalSpins}</Text>
              </BlockStack>
            </Box>

            {/* Emails Collected */}
            <Box
              padding="400"
              borderRightWidth="025"
              borderColor="border-subdued"
              minWidth="180px"
              flex="1"
            >
              <BlockStack gap="100">
                <Text variant="bodySm" fontWeight="semibold" color="subdued">Emails Collected</Text>
                <Text variant="headingLg" as="p" fontWeight="bold" color="success">{totalSpins}</Text>
              </BlockStack>
            </Box>

            {/* Conversions */}
            <Box
              padding="400"
              minWidth="200px"
              flex="1"
            >
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="bodySm" fontWeight="semibold" color="subdued">Conversions</Text>
                  <Text variant="headingLg" as="p" fontWeight="bold" color="success">{conversionRate}%</Text>
                </BlockStack>

                {/* Arrows on the right */}
                <Box paddingInlineStart="400">
                  <Box
                    borderWidth="025"
                    borderColor="border-subdued"
                    borderRadius="200"
                    overflow="hidden"
                  >
                    <InlineStack gap="0">
                      <Box padding="100" borderRightWidth="025" borderColor="border-subdued">
                        <Icon source={ChevronLeftIcon} tone="base" />
                      </Box>
                      <Box padding="100">
                        <Icon source={ChevronRightIcon} tone="base" />
                      </Box>
                    </InlineStack>
                  </Box>
                </Box>
              </InlineStack>
            </Box>
          </InlineStack>
        </Box>

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
