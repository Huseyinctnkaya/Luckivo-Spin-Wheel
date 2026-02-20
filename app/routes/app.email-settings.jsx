import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Box,
  Banner,
  Divider,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const settings = await db.emailSettings.findUnique({
    where: { shop: session.shop },
  });

  return json({
    enabled: settings?.enabled ?? false,
    fromEmail: settings?.fromEmail ?? "",
    fromName: settings?.fromName ?? "Luckivo Spin Wheel",
    subject: settings?.subject ?? "🎁 Your discount code is here!",
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const enabled = formData.get("enabled") === "true";
  const fromEmail = String(formData.get("fromEmail") || "").trim();
  const fromName = String(formData.get("fromName") || "").trim();
  const subject = String(formData.get("subject") || "").trim();

  await db.emailSettings.upsert({
    where: { shop: session.shop },
    update: { enabled, fromEmail, fromName, subject },
    create: { shop: session.shop, enabled, fromEmail, fromName, subject },
  });

  return json({ success: true });
};

export default function EmailSettingsPage() {
  const loaded = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [enabled, setEnabled] = useState(loaded.enabled);
  const [fromEmail, setFromEmail] = useState(loaded.fromEmail);
  const [fromName, setFromName] = useState(loaded.fromName);
  const [subject, setSubject] = useState(loaded.subject);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (navigation.state === "idle" && saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [navigation.state, saved]);

  const handleSave = useCallback(() => {
    submit(
      { enabled: String(enabled), fromEmail, fromName, subject },
      { method: "post" },
    );
    setSaved(true);
  }, [enabled, fromEmail, fromName, subject, submit]);

  return (
    <Page
      title="Email Settings"
      subtitle="Configure discount code emails sent to customers after spinning"
      primaryAction={{
        content: isSaving ? "Saving..." : saved ? "Saved!" : "Save",
        onAction: handleSave,
        disabled: isSaving,
      }}
    >
      <BlockStack gap="500">
        {!loaded.hasResendKey && (
          <Banner title="Resend API key missing" tone="critical">
            <Text as="p">
              Add <strong>RESEND_API_KEY</strong> to your <code>.env</code> file to enable email sending.
              Get your key at <strong>resend.com</strong>.
            </Text>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd" fontWeight="semibold">
                  Email Notifications
                </Text>
                <Text as="p" tone="subdued">
                  Send discount codes to customers via email after they spin
                </Text>
              </BlockStack>
              <div
                onClick={() => setEnabled((v) => !v)}
                style={{
                  width: "44px",
                  height: "24px",
                  borderRadius: "12px",
                  background: enabled ? "#6c5ce7" : "#b5b5b5",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    position: "absolute",
                    top: "2px",
                    left: enabled ? "22px" : "2px",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
            </InlineStack>

            {enabled && (
              <>
                <Divider />
                <BlockStack gap="300">
                  <InlineStack gap="300" wrap={false}>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="From name"
                        value={fromName}
                        onChange={setFromName}
                        autoComplete="off"
                        placeholder="My Store"
                        helpText="Name shown as the sender in the inbox"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="From email"
                        value={fromEmail}
                        onChange={setFromEmail}
                        autoComplete="off"
                        type="email"
                        placeholder="hello@yourdomain.com"
                        helpText="Must be a verified domain in Resend"
                      />
                    </div>
                  </InlineStack>
                  <TextField
                    label="Email subject"
                    value={subject}
                    onChange={setSubject}
                    autoComplete="off"
                    placeholder="🎁 Your discount code is here!"
                  />
                </BlockStack>

                <Box
                  background="bg-surface-secondary"
                  borderRadius="200"
                  padding="300"
                >
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Important
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      For testing, leave the from email empty — emails will be sent from <strong>onboarding@resend.dev</strong>.
                      For production, verify your domain at <strong>resend.com/domains</strong> and enter it above.
                    </Text>
                  </BlockStack>
                </Box>
              </>
            )}
          </BlockStack>
        </Card>

        <Box paddingBlockEnd="800" />
      </BlockStack>
    </Page>
  );
}
