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
  IndexTable,
  EmptyState,
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

  const wheels = await db.wheel.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return json({ totalWheels, activeWheel, totalSpins, wheels });
};

export default function Index() {
  const { totalWheels, activeWheel, totalSpins, wheels } = useLoaderData();

  const resourceName = {
    singular: "wheel",
    plural: "wheels",
  };

  const rowMarkup = wheels.map(
    ({ id, title, isActive, createdAt }, index) => (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {isActive ? (
            <Badge tone="success">Active</Badge>
          ) : (
            <Badge tone="attention">Draft</Badge>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {new Date(createdAt).toLocaleDateString()}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button url={`/app/wheels/${id}`} variant="plain">
            Edit
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page
      title="Lucky Wheel Dashboard"
      primaryAction={
        <Button variant="primary" url="/app/wheels/new">
          Create Wheel
        </Button>
      }
    >
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                <Card>
                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">Total Wheels</Text>
                    <Text variant="headingLg" as="p">{totalWheels}</Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                <Card>
                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">Active Status</Text>
                    <Box>
                      {activeWheel ? (
                        <Badge tone="success">Active Wheel Running</Badge>
                      ) : (
                        <Badge tone="attention">No Active Wheel</Badge>
                      )}
                    </Box>
                  </BlockStack>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                <Card>
                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">Total Spins</Text>
                    <Text variant="headingLg" as="p">{totalSpins}</Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
            </Grid>
          </Layout.Section>

          <Layout.Section>
            {wheels.length === 0 ? (
              <Card>
                <EmptyState
                  heading="Create your first lucky wheel"
                  action={{
                    content: "Create Wheel",
                    url: "/app/wheels/new",
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Customize your wheel, set up prizes, and watch your conversion
                    rates grow.
                  </p>
                </EmptyState>
              </Card>
            ) : (
              <Card padding="0">
                <IndexTable
                  resourceName={resourceName}
                  itemCount={wheels.length}
                  headings={[
                    { title: "Title" },
                    { title: "Status" },
                    { title: "Created At" },
                    { title: "Actions" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              </Card>
            )}
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Storefront Setup
                </Text>
                <Text variant="bodyMd" as="p">
                  Enable the app embed in your theme customizer to show the wheel.
                </Text>
                <Button variant="plain" url="shopify:admin/themes/current/editor?context=apps" target="_blank">
                  Open Theme Editor
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
