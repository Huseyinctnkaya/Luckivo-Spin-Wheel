import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useSubmit,
  useNavigate,
  useMatches,
  Outlet,
} from "@remix-run/react";
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
import { WHEEL_TEMPLATES } from "../data/wheel-templates";

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
    const template = WHEEL_TEMPLATES.find((item) => item.id === templateId);

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
    return json({ error: "Wheel not found." }, { status: 404 });
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

export default function WheelsPage() {
  const { wheels } = useLoaderData();
  const submit = useSubmit();
  const navigate = useNavigate();
  const matches = useMatches();
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const childRouteActive = matches.some(
    (match) =>
      match.id === "routes/app.wheels.$id" ||
      match.id === "routes/app.wheels.new",
  );

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

  if (childRouteActive) {
    return <Outlet />;
  }

  return (
    <Page
      title="Wheels"
      primaryAction={
        <Button variant="primary" onClick={openModal}>
          Create Wheel
        </Button>
      }
    >
      <Card padding="0">
        <Box padding="400" paddingBlockEnd="0">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2" fontWeight="bold">
              Your wheels
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
                  ? "No active wheels"
                  : "Create your first wheel"
              }
              action={{
                content: "Create Wheel",
                onAction: openModal,
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                {filter === "active"
                  ? "Activate a wheel to start collecting emails and rewards."
                  : "Create your first wheel to start collecting emails and rewards."}
              </p>
            </EmptyState>
          </Box>
        ) : (
          <Box paddingBlockStart="400">
            <IndexTable
              resourceName={{ singular: "wheel", plural: "wheels" }}
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
                      <Button
                        size="slim"
                        onClick={() => navigate(`/app/wheels/${wheel.id}`)}
                      >
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
      <Modal open={modalOpen} onClose={closeModal} title="Create Wheel">
        <Modal.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            {WHEEL_TEMPLATES.map((template) => (
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
