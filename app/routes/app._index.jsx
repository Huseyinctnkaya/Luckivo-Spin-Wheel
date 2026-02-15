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

  const titleStyle = {
    borderBottom: '1px dotted #8c9196',
    cursor: 'help'
  };

  return (
    <Page title="Lucky Wheel Dashboard">
      <BlockStack gap="500">

        {/* Pixel-Perfect Stats Bar (Reference: User-provided image) */}
        <Box
          background="bg-surface"
          borderWidth="025"
          borderColor="border"
          borderRadius="300"
          overflow="hidden"
        >
          <InlineStack gap="0" align="stretch" wrap={false}>
            {/* Date Picker Section */}
            <Box padding="400" borderInlineEndWidth="025" borderColor="border-subdued" minWidth="140px">
              <InlineStack gap="200" align="center" blockAlign="center">
                <Icon source={CalendarIcon} tone="base" />
                <Text variant="bodyMd" fontWeight="semibold">7 days</Text>
              </InlineStack>
            </Box>

            {/* Popups Displayed - Highlighted State */}
            <Box
              background="bg-surface-secondary"
              padding="400"
              borderInlineEndWidth="025"
              borderColor="border-subdued"
              flex="1"
              minWidth="220px"
            >
              <BlockStack gap="100">
                <Box>
                  <Text variant="bodySm" fontWeight="semibold" color="subdued">
                    <span style={titleStyle}>Popups Displayed</span>
                  </Text>
                </Box>
                <Text variant="headingLg" as="p" fontWeight="bold" color="success">
                  {totalImpressions}
                </Text>
              </BlockStack>
            </Box>

            {/* Forms Submitted */}
            <Box
              padding="400"
              borderInlineEndWidth="025"
              borderColor="border-subdued"
              flex="1"
              minWidth="200px"
            >
              <BlockStack gap="100">
                <Box>
                  <Text variant="bodySm" fontWeight="semibold" color="subdued">
                    <span style={titleStyle}>Forms Submitted</span>
                  </Text>
                </Box>
                <Text variant="headingLg" as="p" fontWeight="bold" color="success">
                  {totalSpins}
                </Text>
              </BlockStack>
            </Box>

            {/* Emails Collected */}
            <Box
              padding="400"
              borderInlineEndWidth="025"
              borderColor="border-subdued"
              flex="1"
              minWidth="200px"
            >
              <BlockStack gap="100">
                <Box>
                  <Text variant="bodySm" fontWeight="semibold" color="subdued">
                    <span style={titleStyle}>Emails Collected</span>
                  </Text>
                </Box>
                <Text variant="headingLg" as="p" fontWeight="bold" color="success">
                  {totalSpins}
                </Text>
              </BlockStack>
            </Box>

            {/* Conversions Wrapper */}
            <Box
              padding="400"
              flex="1"
              minWidth="220px"
            >
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Box>
                    <Text variant="bodySm" fontWeight="semibold" color="subdued">
                      <span style={titleStyle}>Conversions</span>
                    </Text>
                  </Box>
                  <Text variant="headingLg" as="p" fontWeight="bold" color="success">
                    {conversionRate}%
                  </Text>
                </BlockStack>

                {/* Arrow Navigation */}
                <Box
                  borderWidth="025"
                  borderColor="border-subdued"
                  borderRadius="200"
                  overflow="hidden"
                >
                  <InlineStack gap="0">
                    <Box padding="100" borderInlineEndWidth="025" borderColor="border-subdued">
                      <Icon source={ChevronLeftIcon} tone="base" />
                    </Box>
                    <Box padding="100">
                      <Icon source={ChevronRightIcon} tone="base" />
                    </Box>
                  </InlineStack>
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
