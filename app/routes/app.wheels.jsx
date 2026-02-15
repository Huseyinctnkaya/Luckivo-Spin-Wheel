import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
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
  Modal,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useCallback } from "react";

const TEMPLATES = [
  {
    id: "default",
    name: "Default",
    image: null,
    config: { primaryColor: "#FF6B35", style: "default" },
    segments: [
      { label: "10% OFF", value: "SAVE10", probability: 25, color: "#FF5733" },
      { label: "Better Luck", value: "NONE", probability: 40, color: "#C0C0C0" },
      { label: "20% OFF", value: "SAVE20", probability: 15, color: "#33FF57" },
      { label: "Free Shipping", value: "FREESHIP", probability: 20, color: "#3357FF" },
    ],
  },
  {
    id: "valentine-romance",
    name: "Valentine Romance",
    image: null,
    config: { primaryColor: "#E91E63", style: "valentine-romance" },
    segments: [
      { label: "15% OFF", value: "LOVE15", probability: 25, color: "#E91E63" },
      { label: "Try Again", value: "NONE", probability: 35, color: "#F8BBD0" },
      { label: "25% OFF", value: "LOVE25", probability: 15, color: "#C2185B" },
      { label: "Free Gift", value: "FREEGIFT", probability: 25, color: "#FF4081" },
    ],
  },
  {
    id: "valentine-sweet",
    name: "Valentine Sweet",
    image: null,
    config: { primaryColor: "#FF80AB", style: "valentine-sweet" },
    segments: [
      { label: "10% OFF", value: "SWEET10", probability: 30, color: "#FF80AB" },
      { label: "Better Luck", value: "NONE", probability: 35, color: "#FCE4EC" },
      { label: "20% OFF", value: "SWEET20", probability: 15, color: "#F50057" },
      { label: "Free Shipping", value: "SWEETSHIP", probability: 20, color: "#FF4081" },
    ],
  },
  {
    id: "lunar-new-year",
    name: "Lunar New Year",
    image: null,
    config: { primaryColor: "#D32F2F", style: "lunar-new-year" },
    segments: [
      { label: "Lucky 10%", value: "LUNAR10", probability: 25, color: "#D32F2F" },
      { label: "Try Again", value: "NONE", probability: 35, color: "#FFCDD2" },
      { label: "Lucky 20%", value: "LUNAR20", probability: 15, color: "#FF6F00" },
      { label: "Red Envelope", value: "LUCKY50", probability: 25, color: "#B71C1C" },
    ],
  },
  {
    id: "spin-for-luck",
    name: "Spin for Luck!",
    image: null,
    config: { primaryColor: "#4CAF50", style: "spin-for-luck" },
    segments: [
      { label: "15% OFF", value: "LUCK15", probability: 25, color: "#4CAF50" },
      { label: "No Luck", value: "NONE", probability: 35, color: "#E8F5E9" },
      { label: "30% OFF", value: "LUCK30", probability: 15, color: "#2E7D32" },
      { label: "Free Shipping", value: "LUCKSHIP", probability: 25, color: "#66BB6A" },
    ],
  },
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const wheels = await db.wheel.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return json({ wheels });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");

  if (intent === "createFromTemplate") {
    const templateId = formData.get("templateId");
    const template = TEMPLATES.find((item) => item.id === templateId);

    if (!template) {
      return json({ error: "Template not found." }, { status: 404 });
    }

    await db.wheel.create({
      data: {
        shop: session.shop,
        title: template.name,
        isActive: false,
        config: JSON.stringify(template.config),
        segments: {
          create: template.segments.map((segment) => ({
            label: segment.label,
            value: segment.value,
            probability: segment.probability,
            color: segment.color,
          })),
        },
      },
    });

    return redirect("/app/wheels");
  }

  const wheelId = formData.get("wheelId");

  if (typeof wheelId !== "string" || wheelId.length === 0) {
    return json({ error: "Missing wheel id." }, { status: 400 });
  }

  const wheel = await db.wheel.findFirst({
    where: { id: wheelId, shop: session.shop },
    include: { segments: true },
  });

  if (!wheel) {
    return json({ error: "Campaign not found." }, { status: 404 });
  }

  if (intent === "delete") {
    await db.wheel.delete({ where: { id: wheel.id } });
    return redirect("/app/wheels");
  }

  if (intent === "duplicate") {
    await db.wheel.create({
      data: {
        shop: session.shop,
        title: `${wheel.title} Copy`,
        isActive: false,
        config: wheel.config,
        segments: {
          create: wheel.segments.map((segment) => ({
            label: segment.label,
            value: segment.value,
            probability: segment.probability,
            color: segment.color,
          })),
        },
      },
    });
    return redirect("/app/wheels");
  }

  return json({ error: "Unknown intent." }, { status: 400 });
};

export default function CampaignsPage() {
  const { wheels } = useLoaderData();
  const submit = useSubmit();
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const handleSelectTemplate = (templateId) => {
    setModalOpen(false);
    submit({ intent: "createFromTemplate", templateId }, { method: "post" });
  };

  const filtered =
    filter === "active"
      ? wheels.filter((w) => w.isActive)
      : wheels;

  return (
    <Page
      title="Campaigns"
      primaryAction={
        <Button variant="primary" onClick={openModal}>
          Create Campaign
        </Button>
      }
    >
      <Card padding="0">
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
                onAction: openModal,
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
                { title: "Name" },
                { title: "Status" },
                { title: "Actions", alignment: "end" },
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
                    <InlineStack align="end" gap="200">
                      <Button url={`/app/wheels/${wheel.id}`} size="slim">
                        Edit
                      </Button>
                      <Button
                        size="slim"
                        onClick={() =>
                          submit(
                            { intent: "duplicate", wheelId: wheel.id },
                            { method: "post" },
                          )
                        }
                      >
                        Duplicate
                      </Button>
                      <Button
                        size="slim"
                        tone="critical"
                        onClick={() =>
                          submit(
                            { intent: "delete", wheelId: wheel.id },
                            { method: "post" },
                          )
                        }
                      >
                        Delete
                      </Button>
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Box>
        )}
      </Card>

      {/* Template Selection Modal */}
      <Modal open={modalOpen} onClose={closeModal} title="Create Campaign">
        <Modal.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            {TEMPLATES.map((template) => (
              <div
                key={template.id}
                style={{
                  border: "1px solid #e3e3e3",
                  borderRadius: "12px",
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                {/* Image placeholder */}
                <div
                  style={{
                    width: "100%",
                    height: "180px",
                    background: "#f6f6f7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderBottom: "1px solid #e3e3e3",
                  }}
                >
                  {template.image ? (
                    <img
                      src={template.image}
                      alt={template.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <Text tone="subdued" variant="bodySm">
                      Preview
                    </Text>
                  )}
                </div>
                {/* Footer */}
                <div
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text variant="bodyMd" fontWeight="semibold">
                    {template.name}
                  </Text>
                  <Button
                    onClick={() => handleSelectTemplate(template.id)}
                    size="slim"
                  >
                    Select
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
