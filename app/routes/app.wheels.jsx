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

function buildTemplateWheelGradient(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return "conic-gradient(#f3f3f3 0deg 360deg)";
  }

  const total = segments.reduce((sum, segment) => {
    const probability = Number(segment?.probability || 0);
    return sum + (Number.isFinite(probability) ? probability : 0);
  }, 0);

  const parts = [];
  let cursor = 0;

  segments.forEach((segment) => {
    const probability = Number(segment?.probability || 0);
    const ratio = total > 0 ? probability / total : 1 / segments.length;
    const sweep = ratio * 360;
    const start = cursor;
    const end = cursor + sweep;
    const color = segment?.color || "#f6b347";
    parts.push(`${color} ${start}deg ${end}deg`);
    cursor = end;
  });

  return `conic-gradient(${parts.join(", ")})`;
}

function TemplatePreview({ template }) {
  const gradient = buildTemplateWheelGradient(template?.segments);
  const backgroundColor = template?.config?.backgroundColor || "#f6f6f7";
  const headingColor = template?.config?.textColor || "#2d3436";
  const buttonColor =
    template?.config?.buttonBackgroundColor || template?.config?.primaryColor || "#303030";
  const buttonTextColor = template?.config?.buttonTextColor || "#ffffff";
  const title = String(template?.config?.title || template?.name || "Wheel").slice(0, 24);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: "12px",
        background: backgroundColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Text as="p" variant="bodySm" fontWeight="semibold">
        <span style={{ color: headingColor }}>{title}</span>
      </Text>

      <div
        style={{
          width: "112px",
          height: "112px",
          borderRadius: "50%",
          border: "4px solid #f1ad46",
          background: gradient,
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-10px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            border: "3px solid #f1ad46",
            background: "#fff",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            border: "3px solid #fff",
            background: template?.config?.primaryColor || "#6C5CE7",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "8px",
            fontWeight: 700,
          }}
        >
          SPIN
        </div>
      </div>

      <div
        style={{
          width: "100%",
          borderRadius: "6px",
          background: buttonColor,
          color: buttonTextColor,
          textAlign: "center",
          fontSize: "10px",
          fontWeight: 700,
          padding: "5px 8px",
          boxSizing: "border-box",
        }}
      >
        {template?.config?.ctaText || "SPIN NOW"}
      </div>
    </div>
  );
}

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
                    height: "220px",
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
                    <TemplatePreview template={template} />
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
