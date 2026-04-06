import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const record = await db.customCode.findUnique({
    where: { shop: session.shop },
  });

  return json({ code: record?.code || "" });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const code = formData.get("code") || "";

  await db.customCode.upsert({
    where: { shop: session.shop },
    update: { code },
    create: { shop: session.shop, code },
  });

  return json({ success: true });
};

export default function CustomCodePage() {
  const { code: savedCode } = useLoaderData();
  const [code, setCode] = useState(savedCode);
  const submit = useSubmit();
  const navigation = useNavigation();

  const isSaving = navigation.state === "submitting";
  const hasChanges = code !== savedCode;
  const { t } = useLanguage();

  const handleSave = () => {
    const formData = new FormData();
    formData.set("code", code);
    submit(formData, { method: "post" });
  };

  return (
    <Page title={t("custom_code_title")} backAction={{ url: "/app" }}>
      <BlockStack gap="400">
        <Banner tone="info">
          <p>{t("custom_code_banner")}</p>
        </Banner>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingSm" as="h3">
              {t("custom_code_card_title")}
            </Text>
            <div
              style={{
                border: "1px solid #e3e3e3",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={`<style>\n  /* Add your custom CSS here */\n</style>\n\n<script>\n  // Add your custom JavaScript here\n</script>`}
                style={{
                  width: "100%",
                  minHeight: "300px",
                  padding: "12px",
                  border: "none",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  background: "#fafafa",
                  color: "#303030",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={isSaving}
                disabled={!hasChanges || isSaving}
              >
                {t("save")}
              </Button>
            </div>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
