import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  FormLayout,
  BlockStack,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState } from "react";

const TEMPLATES = {
  default: {
    title: "Spin & Win",
    config: { primaryColor: "#FF6B35", style: "default" },
    segments: [
      { label: "10% OFF", value: "SAVE10", probability: 25, color: "#FF5733" },
      { label: "Better Luck", value: "NONE", probability: 40, color: "#C0C0C0" },
      { label: "20% OFF", value: "SAVE20", probability: 15, color: "#33FF57" },
      { label: "Free Shipping", value: "FREESHIP", probability: 20, color: "#3357FF" },
    ],
  },
  "valentine-romance": {
    title: "Valentine Romance",
    config: { primaryColor: "#E91E63", style: "valentine-romance" },
    segments: [
      { label: "15% OFF", value: "LOVE15", probability: 25, color: "#E91E63" },
      { label: "Try Again", value: "NONE", probability: 35, color: "#F8BBD0" },
      { label: "25% OFF", value: "LOVE25", probability: 15, color: "#C2185B" },
      { label: "Free Gift", value: "FREEGIFT", probability: 25, color: "#FF4081" },
    ],
  },
  "valentine-sweet": {
    title: "Sweet Valentine",
    config: { primaryColor: "#FF80AB", style: "valentine-sweet" },
    segments: [
      { label: "10% OFF", value: "SWEET10", probability: 30, color: "#FF80AB" },
      { label: "Better Luck", value: "NONE", probability: 35, color: "#FCE4EC" },
      { label: "20% OFF", value: "SWEET20", probability: 15, color: "#F50057" },
      { label: "Free Shipping", value: "SWEETSHIP", probability: 20, color: "#FF4081" },
    ],
  },
  "lunar-new-year": {
    title: "Lunar New Year",
    config: { primaryColor: "#D32F2F", style: "lunar-new-year" },
    segments: [
      { label: "Lucky 10%", value: "LUNAR10", probability: 25, color: "#D32F2F" },
      { label: "Try Again", value: "NONE", probability: 35, color: "#FFCDD2" },
      { label: "Lucky 20%", value: "LUNAR20", probability: 15, color: "#FF6F00" },
      { label: "Red Envelope", value: "LUCKY50", probability: 25, color: "#B71C1C" },
    ],
  },
  "spin-for-luck": {
    title: "Spin for Luck!",
    config: { primaryColor: "#4CAF50", style: "spin-for-luck" },
    segments: [
      { label: "15% OFF", value: "LUCK15", probability: 25, color: "#4CAF50" },
      { label: "No Luck", value: "NONE", probability: 35, color: "#E8F5E9" },
      { label: "30% OFF", value: "LUCK30", probability: 15, color: "#2E7D32" },
      { label: "Free Shipping", value: "LUCKSHIP", probability: 25, color: "#66BB6A" },
    ],
  },
};

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const templateId = url.searchParams.get("template") || "default";
  const template = TEMPLATES[templateId] || TEMPLATES.default;

  return json({ template, templateId });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const title = formData.get("title");
  const config = formData.get("config");
  const segmentsRaw = formData.get("segments");

  let segments;
  try {
    segments = JSON.parse(segmentsRaw);
  } catch {
    segments = TEMPLATES.default.segments;
  }

  const wheel = await db.wheel.create({
    data: {
      shop: session.shop,
      title,
      config,
      isActive: false,
      segments: {
        create: segments.map((s) => ({
          label: s.label,
          value: s.value,
          probability: s.probability,
          color: s.color || null,
        })),
      },
    },
  });

  return redirect(`/app/wheels/${wheel.id}`);
};

export default function NewWheel() {
  const { template } = useLoaderData();
  const [title, setTitle] = useState(template.title);
  const [primaryColor, setPrimaryColor] = useState(template.config.primaryColor);

  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const handleSave = () => {
    const config = JSON.stringify({
      ...template.config,
      primaryColor,
    });

    submit(
      {
        title,
        config,
        segments: JSON.stringify(template.segments),
      },
      { method: "post" },
    );
  };

  return (
    <Page
      backAction={{ content: "Campaigns", url: "/app/wheels" }}
      title="Create Campaign"
      primaryAction={
        <Button variant="primary" onClick={handleSave} loading={isLoading}>
          Save and Edit Segments
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <FormLayout>
                <TextField
                  label="Campaign Title"
                  value={title}
                  onChange={setTitle}
                  autoComplete="off"
                  helpText="Give your campaign a name (internal use only)"
                />
                <TextField
                  label="Primary Theme Color"
                  value={primaryColor}
                  onChange={setPrimaryColor}
                  autoComplete="off"
                  prefix="#"
                  helpText="Choose a primary color for your wheel (Hex code)"
                />
              </FormLayout>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">
                Template Segments
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                This template includes {template.segments.length} segments:
              </Text>
              <BlockStack gap="100">
                {template.segments.map((seg, i) => (
                  <InlineSegment key={i} segment={seg} />
                ))}
              </BlockStack>
              <Text variant="bodySm" tone="subdued" as="p">
                You can edit segments after saving.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function InlineSegment({ segment }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div
        style={{
          width: "12px",
          height: "12px",
          borderRadius: "3px",
          background: segment.color || "#ccc",
          flexShrink: 0,
        }}
      />
      <Text variant="bodyMd" as="span">
        {segment.label}
      </Text>
      <Text variant="bodySm" as="span" tone="subdued">
        ({segment.probability}%)
      </Text>
    </div>
  );
}
