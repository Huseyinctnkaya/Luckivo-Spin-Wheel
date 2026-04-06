import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Box,
  Banner,
  Divider,
  ColorPicker,
  Modal,
  hsbToHex,
  hexToRgb,
  rgbToHsb,
} from "@shopify/polaris";
import { SaveBar } from "@shopify/app-bridge-react";
import { useState, useCallback, useMemo } from "react";
import { useLanguage } from "../i18n/LanguageContext";

function toHsbColor(hex) {
  try {
    const clean = String(hex || "").replace("#", "");
    const rgb = hexToRgb(clean);
    return rgbToHsb(rgb);
  } catch {
    return { hue: 259, brightness: 0.91, saturation: 0.58 };
  }
}

function normalizeHex(hex) {
  const clean = String(hex || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean;
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return "#" + clean;
  return "#6c5ce7";
}

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
    headerTitle: settings?.headerTitle ?? "You Won!",
    headerSubtitle: settings?.headerSubtitle ?? "Congratulations on your lucky spin",
    headerEmoji: settings?.headerEmoji ?? "🎡",
    brandColor: settings?.brandColor ?? "#6c5ce7",
    ctaText: settings?.ctaText ?? "",
    ctaUrl: settings?.ctaUrl ?? "",
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
  const headerTitle = String(formData.get("headerTitle") || "").trim();
  const headerSubtitle = String(formData.get("headerSubtitle") || "").trim();
  const headerEmoji = String(formData.get("headerEmoji") || "").trim();
  const brandColor = String(formData.get("brandColor") || "").trim();
  const ctaText = String(formData.get("ctaText") || "").trim();
  const ctaUrl = String(formData.get("ctaUrl") || "").trim();

  await db.emailSettings.upsert({
    where: { shop: session.shop },
    update: { enabled, fromEmail, fromName, subject, headerTitle, headerSubtitle, headerEmoji, brandColor, ctaText, ctaUrl },
    create: { shop: session.shop, enabled, fromEmail, fromName, subject, headerTitle, headerSubtitle, headerEmoji, brandColor, ctaText, ctaUrl },
  });

  return json({ success: true });
};

function buildPreviewHtml({ headerTitle, headerSubtitle, headerEmoji, brandColor, ctaText, ctaUrl }) {
  const safeColor = normalizeHex(brandColor);
  const ctaBlock = ctaText && ctaUrl
    ? `<tr>
        <td style="padding:0 40px 28px;text-align:center;">
          <a href="${ctaUrl}" style="display:inline-block;background:${safeColor};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;padding:14px 32px;">
            ${ctaText}
          </a>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:560px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,${safeColor} 0%,${safeColor}99 100%);padding:36px 40px 28px;text-align:center;">
            <div style="font-size:44px;margin-bottom:10px;">${headerEmoji || "🎡"}</div>
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${headerTitle || "You Won!"}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${headerSubtitle || "Congratulations on your lucky spin"}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 24px;">
            <p style="margin:0 0 6px;color:#636e72;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Your reward</p>
            <p style="margin:0 0 24px;color:#2d3436;font-size:19px;font-weight:700;">20% OFF</p>
            <p style="margin:0 0 10px;color:#636e72;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Your discount code</p>
            <div style="background:#f8f7ff;border:2px dashed ${safeColor};border-radius:12px;padding:18px;text-align:center;margin-bottom:24px;">
              <span style="font-size:26px;font-weight:800;color:#2d3436;letter-spacing:3px;">DISCOUNT20</span>
            </div>
            <p style="margin:0;color:#636e72;font-size:13px;line-height:1.6;">Copy the code above and use it at checkout to claim your discount. This code is unique to you, so keep it safe!</p>
          </td>
        </tr>
        ${ctaBlock}
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            <p style="margin:0;color:#b2bec3;font-size:12px;">This email was sent by <strong>Your Store</strong> via Luckivo Spin Wheel.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export default function EmailSettingsPage() {
  const loaded = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const { t } = useLanguage();

  const [enabled, setEnabled] = useState(loaded.enabled);
  const [fromEmail, setFromEmail] = useState(loaded.fromEmail);
  const [fromName, setFromName] = useState(loaded.fromName);
  const [subject, setSubject] = useState(loaded.subject);
  const [headerTitle, setHeaderTitle] = useState(loaded.headerTitle);
  const [headerSubtitle, setHeaderSubtitle] = useState(loaded.headerSubtitle);
  const [headerEmoji, setHeaderEmoji] = useState(loaded.headerEmoji);
  const [brandColor, setBrandColor] = useState(normalizeHex(loaded.brandColor));
  const [brandColorHsb, setBrandColorHsb] = useState(() => toHsbColor(loaded.brandColor));
  const [ctaText, setCtaText] = useState(loaded.ctaText);
  const [ctaUrl, setCtaUrl] = useState(loaded.ctaUrl);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const savedSnapshot = useMemo(
    () => JSON.stringify({
      enabled: loaded.enabled,
      fromEmail: loaded.fromEmail,
      fromName: loaded.fromName,
      subject: loaded.subject,
      headerTitle: loaded.headerTitle,
      headerSubtitle: loaded.headerSubtitle,
      headerEmoji: loaded.headerEmoji,
      brandColor: normalizeHex(loaded.brandColor),
      ctaText: loaded.ctaText,
      ctaUrl: loaded.ctaUrl,
    }),
    [loaded],
  );

  const currentSnapshot = JSON.stringify({
    enabled,
    fromEmail,
    fromName,
    subject,
    headerTitle,
    headerSubtitle,
    headerEmoji,
    brandColor,
    ctaText,
    ctaUrl,
  });

  const isDirty = savedSnapshot !== currentSnapshot;

  const handleBrandColorChange = useCallback((hsb) => {
    setBrandColorHsb(hsb);
    setBrandColor("#" + hsbToHex(hsb));
  }, []);

  const handleSave = useCallback(() => {
    submit(
      {
        enabled: String(enabled),
        fromEmail,
        fromName,
        subject,
        headerTitle,
        headerSubtitle,
        headerEmoji,
        brandColor,
        ctaText,
        ctaUrl,
      },
      { method: "post" },
    );
  }, [enabled, fromEmail, fromName, subject, headerTitle, headerSubtitle, headerEmoji, brandColor, ctaText, ctaUrl, submit]);

  const handleDiscard = useCallback(() => {
    setEnabled(loaded.enabled);
    setFromEmail(loaded.fromEmail);
    setFromName(loaded.fromName);
    setSubject(loaded.subject);
    setHeaderTitle(loaded.headerTitle);
    setHeaderSubtitle(loaded.headerSubtitle);
    setHeaderEmoji(loaded.headerEmoji);
    setBrandColor(normalizeHex(loaded.brandColor));
    setBrandColorHsb(toHsbColor(loaded.brandColor));
    setCtaText(loaded.ctaText);
    setCtaUrl(loaded.ctaUrl);
  }, [loaded]);

  const previewHtml = buildPreviewHtml({ headerTitle, headerSubtitle, headerEmoji, brandColor, ctaText, ctaUrl });

  return (
    <>
      <SaveBar open={isDirty}>
        <button variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? t("saving") : t("save")}
        </button>
        <button onClick={handleDiscard} disabled={isSaving}>
          {t("discard")}
        </button>
      </SaveBar>

    <Page
      title={t("email_settings_title")}
      subtitle={t("email_settings_subtitle")}
      secondaryActions={[
        {
          content: t("email_settings_preview_btn"),
          onAction: () => setPreviewModalOpen(true),
        },
      ]}
    >
      <Layout>
        {!loaded.hasResendKey && (
          <Layout.Section>
            <Banner title={t("email_settings_no_resend_title")} tone="critical">
              <Text as="p">
                {t("email_settings_no_resend_desc")}
              </Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <BlockStack gap="400">

            {/* Send settings */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd" fontWeight="semibold">
                      {t("email_notifications_title")}
                    </Text>
                    <Text as="p" tone="subdued">
                      {t("email_notifications_desc")}
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
                      <TextField
                        label={t("email_from_name")}
                        value={fromName}
                        onChange={setFromName}
                        autoComplete="off"
                        placeholder="My Store"
                        helpText={t("email_from_name_help")}
                      />
                      <TextField
                        label={t("email_reply_to")}
                        value={fromEmail}
                        onChange={setFromEmail}
                        autoComplete="off"
                        type="email"
                        placeholder="hello@yourdomain.com"
                        helpText={t("email_reply_to_help")}
                      />
                      <TextField
                        label={t("email_subject")}
                        value={subject}
                        onChange={setSubject}
                        autoComplete="off"
                        placeholder="🎁 Your discount code is here!"
                      />
                    </BlockStack>

                    <Box background="bg-surface-secondary" borderRadius="200" padding="300">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" fontWeight="semibold">{t("email_how_it_works_title")}</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {t("email_how_it_works_desc")}
                        </Text>
                      </BlockStack>
                    </Box>
                  </>
                )}
              </BlockStack>
            </Card>

            {/* Template editor */}
            {enabled && <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd" fontWeight="semibold">
                  {t("email_template_title")}
                </Text>
                <Text as="p" tone="subdued">
                  {t("email_template_desc")}
                </Text>

                <Divider />

                {/* Header section */}
                <BlockStack gap="300">
                  <Text as="p" variant="bodySm" fontWeight="semibold" tone="subdued">HEADER</Text>
                  <InlineStack gap="300" wrap={false}>
                    <div style={{ width: "90px", flexShrink: 0 }}>
                      <TextField
                        label="Emoji"
                        value={headerEmoji}
                        onChange={setHeaderEmoji}
                        autoComplete="off"
                        placeholder="🎡"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Title"
                        value={headerTitle}
                        onChange={setHeaderTitle}
                        autoComplete="off"
                        placeholder="You Won!"
                      />
                    </div>
                  </InlineStack>
                  <TextField
                    label="Subtitle"
                    value={headerSubtitle}
                    onChange={setHeaderSubtitle}
                    autoComplete="off"
                    placeholder="Congratulations on your lucky spin"
                  />
                </BlockStack>

                <Divider />

                {/* Brand color */}
                <BlockStack gap="300">
                  <Text as="p" variant="bodySm" fontWeight="semibold" tone="subdued">BRAND COLOR</Text>
                  <InlineStack gap="300" blockAlign="center">
                    <div
                      onClick={() => setColorPickerOpen((v) => !v)}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        background: brandColor,
                        cursor: "pointer",
                        border: "2px solid rgba(0,0,0,0.12)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ width: "130px" }}>
                      <TextField
                        label=""
                        labelHidden
                        value={brandColor}
                        onChange={(v) => {
                          setBrandColor(v);
                          if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                            setBrandColorHsb(toHsbColor(v));
                          }
                        }}
                        autoComplete="off"
                        placeholder="#6c5ce7"
                        monospaced
                      />
                    </div>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Header background and accent color
                    </Text>
                  </InlineStack>
                  {colorPickerOpen && (
                    <Box paddingBlockStart="200">
                      <ColorPicker color={brandColorHsb} onChange={handleBrandColorChange} />
                    </Box>
                  )}
                </BlockStack>

                <Divider />

                {/* CTA Button */}
                <BlockStack gap="300">
                  <Text as="p" variant="bodySm" fontWeight="semibold" tone="subdued">
                    {t("email_cta_optional")}
                  </Text>
                  <TextField
                    label={t("email_cta_btn_text")}
                    value={ctaText}
                    onChange={setCtaText}
                    autoComplete="off"
                    placeholder="Shop Now"
                  />
                  <TextField
                    label={t("email_cta_btn_url")}
                    value={ctaUrl}
                    onChange={setCtaUrl}
                    autoComplete="off"
                    type="url"
                    placeholder="https://yourstore.com"
                  />
                  <Text as="p" variant="bodySm" tone="subdued">{t("email_cta_empty_hint")}</Text>
                </BlockStack>

              </BlockStack>
            </Card>}

          </BlockStack>
        </Layout.Section>

      </Layout>

      <Box paddingBlockEnd="800" />

      <Modal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title={t("email_preview_modal_title")}
        size="large"
      >
        <Modal.Section>
          <div
            style={{
              background: "#f4f4f5",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "center",
              padding: "0",
            }}
          >
            <iframe
              srcDoc={previewHtml}
              title="Email preview"
              style={{
                width: "560px",
                height: "720px",
                border: "none",
                display: "block",
                flexShrink: 0,
              }}
              sandbox="allow-same-origin"
            />
          </div>
        </Modal.Section>
      </Modal>
    </Page>
    </>
  );
}
