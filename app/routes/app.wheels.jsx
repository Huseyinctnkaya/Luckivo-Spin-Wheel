import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Button,
  Text,
  EmptyState,
  InlineStack,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const wheels = await db.wheel.findMany({
    where: { shop: session.shop },
    include: {
      _count: { select: { spins: true, impressions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ wheels });
};

export default function CampaignsPage() {
  const { wheels } = useLoaderData();
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "active"
      ? wheels.filter((w) => w.isActive)
      : wheels;

  return (
    <Page
      title="Campaigns"
      primaryAction={
        <Button variant="primary" url="/app/wheels/new">
          Create Campaign
        </Button>
      }
    >
      <Card padding="0">
        {/* Card header with tabs */}
        <Box padding="400" paddingBlockEnd="0">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2" fontWeight="bold">
              Your campaigns
            </Text>
            <div
              style={{
                display: "flex",
                border: "1px solid #e3e3e3",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setFilter("all")}
                style={{
                  padding: "6px 14px",
                  border: "none",
                  background: filter === "all" ? "#f6f6f7" : "transparent",
                  fontWeight: filter === "all" ? 600 : 400,
                  cursor: "pointer",
                  fontSize: "13px",
                  borderRight: "1px solid #e3e3e3",
                }}
              >
                All
              </button>
              <button
                onClick={() => setFilter("active")}
                style={{
                  padding: "6px 14px",
                  border: "none",
                  background: filter === "active" ? "#f6f6f7" : "transparent",
                  fontWeight: filter === "active" ? 600 : 400,
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                Active/Scheduled
              </button>
            </div>
          </InlineStack>
        </Box>

        {filtered.length === 0 ? (
          <Box padding="400">
            <EmptyState
              heading={
                filter === "active"
                  ? "No active campaigns"
                  : "Create your first campaign"
              }
              action={{
                content: "Create Campaign",
                url: "/app/wheels/new",
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                {filter === "active"
                  ? "Activate a campaign to start collecting emails and rewards."
                  : "Create your first campaign to start collecting emails and rewards."}
              </p>
            </EmptyState>
          </Box>
        ) : (
          <Box paddingBlockStart="400">
            <IndexTable
              resourceName={{ singular: "campaign", plural: "campaigns" }}
              itemCount={filtered.length}
              headings={[
                { title: "Campaign" },
                { title: "Status" },
                { title: "Impressions", alignment: "end" },
                { title: "Spins", alignment: "end" },
                { title: "Created" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {filtered.map((wheel, index) => (
                <IndexTable.Row id={wheel.id} key={wheel.id} position={index}>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" fontWeight="bold" as="span">
                      {wheel.title}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {wheel.isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="attention">Draft</Badge>
                    )}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" alignment="end" variant="bodyMd">
                      {wheel._count.impressions}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" alignment="end" variant="bodyMd">
                      {wheel._count.spins}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" as="span" tone="subdued">
                      {new Date(wheel.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Button url={`/app/wheels/${wheel.id}`} variant="plain">
                      Edit
                    </Button>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Box>
        )}
      </Card>
    </Page>
  );
}
