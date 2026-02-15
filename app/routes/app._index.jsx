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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const totalWheels = await db.wheel.count({
    where: { shop: session.shop }
  });

  const activeWheel = await db.wheel.findFirst({
    where: { shop: session.shop, isActive: true }
  });

  const totalSpins = await db.spin.count({
    where: { wheel: { shop: session.shop } }
  });

  return json({ totalWheels, activeWheel, totalSpins });
};

export default function Index() {
  const { totalWheels, activeWheel, totalSpins } = useLoaderData();

  return (
    <Page title="Lucky Wheel Dashboard">
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Welcome back! 🎉
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Manage your lucky wheels and track their performance from the Wheels page.
                  </Text>
                </BlockStack>

                <Grid>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                    <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h3">Total Wheels</Text>
                        <Text variant="headingLg" as="p">{totalWheels}</Text>
                      </BlockStack>
                    </Box>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                    <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h3">Active Status</Text>
                        <Box>
                          {activeWheel ? (
                            <Badge tone="success">Active</Badge>
                          ) : (
                            <Badge tone="attention">No Active Wheel</Badge>
                          )}
                        </Box>
                      </BlockStack>
                    </Box>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                    <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h3">Total Spins</Text>
                        <Text variant="headingLg" as="p">{totalSpins}</Text>
                      </BlockStack>
                    </Box>
                  </Grid.Cell>
                </Grid>

                <InlineStack gap="300">
                  <Button variant="primary" url="/app/wheels">
                    Manage Wheels
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Quick Tips
                  </Text>
                  <Text variant="bodyMd" as="p">
                    - Keep your probabilities sum to 100% for fairness.
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Storefront Ready?
                  </Text>
                  <Button variant="plain" url="shopify:admin/themes/current/editor?context=apps" target="_blank">
                    Open Theme Editor
                  </Button>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
