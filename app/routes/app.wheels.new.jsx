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
import {
  DEFAULT_WHEEL_TEMPLATE_ID,
  WHEEL_TEMPLATE_MAP,
} from "../data/wheel-templates";
import { useLanguage } from "../i18n/LanguageContext";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const templateId = url.searchParams.get("template") || DEFAULT_WHEEL_TEMPLATE_ID;
  const template = WHEEL_TEMPLATE_MAP[templateId] || WHEEL_TEMPLATE_MAP[DEFAULT_WHEEL_TEMPLATE_ID];

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
    segments = WHEEL_TEMPLATE_MAP[DEFAULT_WHEEL_TEMPLATE_ID].segments;
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
  const [title, setTitle] = useState(template.name);
  const [primaryColor, setPrimaryColor] = useState(template.config.primaryColor);

  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";
  const { t } = useLanguage();

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
      backAction={{ content: t("wheel_new_back"), url: "/app/wheels" }}
      title={t("wheel_new_title")}
      primaryAction={
        <Button variant="primary" onClick={handleSave} loading={isLoading}>
          {t("wheel_new_save_btn")}
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <FormLayout>
                <TextField
                  label={t("wheel_new_field_title")}
                  value={title}
                  onChange={setTitle}
                  autoComplete="off"
                  helpText={t("wheel_new_field_title_help")}
                />
                <TextField
                  label={t("wheel_new_field_color")}
                  value={primaryColor}
                  onChange={setPrimaryColor}
                  autoComplete="off"
                  prefix="#"
                  helpText={t("wheel_new_field_color_help")}
                />
              </FormLayout>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">
                {t("wheel_new_template_title")}
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                {t("wheel_new_template_desc", template.segments.length)}
              </Text>
              <BlockStack gap="100">
                {template.segments.map((seg, i) => (
                  <InlineSegment key={i} segment={seg} />
                ))}
              </BlockStack>
              <Text variant="bodySm" tone="subdued" as="p">
                {t("wheel_new_template_footer")}
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
