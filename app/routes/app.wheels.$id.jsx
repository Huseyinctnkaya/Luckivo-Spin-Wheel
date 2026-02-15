import { useEffect, useMemo, useRef, useState } from "react";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  BlockStack,
  InlineGrid,
  Text,
  Badge,
  Banner,
  Box,
  InlineStack,
  Select,
  Icon,
  Popover,
  ColorPicker,
  hsbToHex,
  hexToRgb,
  rgbToHsb,
} from "@shopify/polaris";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DesktopIcon,
  MobileIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const WHEEL_STYLE_OPTIONS = [
  { label: "Default", value: "default" },
  { label: "Classic", value: "classic" },
];

const EFFECT_OPTIONS = [
  { label: "Default", value: "default" },
  { label: "Valentine - Falling Hearts", value: "valentine_falling_hearts" },
  { label: "Halloween dark", value: "halloween_dark" },
  { label: "Halloween light", value: "halloween_light" },
];

const POPUP_BEHAVIOR_OPTIONS = [
  { label: "Default (form + spin together)", value: "default" },
  { label: "Collect email before spin", value: "email_first" },
  { label: "Spin first, reveal form later", value: "spin_first" },
];

const PREVIEW_TABS = [
  { label: "Initial", value: "initial" },
  { label: "Result", value: "result" },
  { label: "Side button", value: "side_button" },
  { label: "Countdown", value: "countdown" },
];

const LOGO_POSITION_OPTIONS = [
  { label: "Center of wheel", value: "center_of_wheel" },
  { label: "Top of popup", value: "top_of_popup" },
  { label: "Both", value: "both" },
];

function parseConfig(rawConfig) {
  try {
    return JSON.parse(rawConfig || "{}");
  } catch {
    return {};
  }
}

function getValidOptionValue(options, value, fallback) {
  return options.some((option) => option.value === value) ? value : fallback;
}

function normalizeHex(input, fallback) {
  if (typeof input !== "string") return fallback;
  const value = input.trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{6}$/.test(value) || /^[0-9A-Fa-f]{3}$/.test(value)) {
    return `#${value}`;
  }
  return fallback;
}

function toHsbColor(input, fallback) {
  const safeHex = normalizeHex(input, fallback);
  const rgb = hexToRgb(safeHex);
  return rgbToHsb(rgb);
}

function buildWheelGradient(segments) {
  if (segments.length === 0) {
    return "conic-gradient(#f3f3f3 0deg 360deg)";
  }

  const total = segments.reduce((sum, segment) => {
    const probability = Number(segment.probability || 0);
    return sum + (Number.isFinite(probability) ? probability : 0);
  }, 0);

  const parts = [];
  let cursor = 0;

  segments.forEach((segment) => {
    const probability = Number(segment.probability || 0);
    const ratio =
      total > 0
        ? probability / total
        : 1 / segments.length;
    const next = cursor + ratio * 360;
    const color = normalizeHex(segment.color, "#ffcc80");
    parts.push(`${color} ${cursor}deg ${next}deg`);
    cursor = next;
  });

  return `conic-gradient(${parts.join(", ")})`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Image could not be read"));
    reader.readAsDataURL(file);
  });
}

function ColorField({ label, value, onChange, fallback = "#000000" }) {
  const normalized = normalizeHex(value, fallback);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerColor, setPickerColor] = useState(() =>
    toHsbColor(normalized, fallback),
  );

  useEffect(() => {
    setPickerColor(toHsbColor(normalized, fallback));
  }, [normalized, fallback]);

  const handlePickerChange = (nextColor) => {
    setPickerColor(nextColor);
    onChange(normalizeHex(hsbToHex(nextColor), fallback));
  };

  const activator = (
    <button
      type="button"
      onClick={() => setPickerOpen((open) => !open)}
      style={{
        width: "100%",
        border: "1px solid #c9cccf",
        borderRadius: "10px",
        padding: "8px 10px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "#fff",
        color: "#303030",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "4px",
          border: "1px solid #b5b5b5",
          background: normalized,
          flexShrink: 0,
        }}
      />
      <Text as="span" variant="bodyMd">
        {normalized.toUpperCase()}
      </Text>
    </button>
  );

  return (
    <div>
      <Text as="p" variant="bodyMd" tone="subdued">
        {label}
      </Text>
      <div style={{ marginTop: "6px" }}>
        <Popover
          active={pickerOpen}
          activator={activator}
          autofocusTarget="none"
          onClose={() => setPickerOpen(false)}
        >
          <Box padding="300">
            <ColorPicker color={pickerColor} onChange={handlePickerChange} />
          </Box>
        </Popover>
      </div>
    </div>
  );
}

export const loader = async ({ params, request }) => {
  await authenticate.admin(request);
  const wheel = await db.wheel.findUnique({
    where: { id: params.id },
    include: { segments: true },
  });

  if (!wheel) throw new Response("Not Found", { status: 404 });

  return json({ wheel });
};

export const action = async ({ request, params }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await db.wheel.delete({ where: { id: params.id } });
    return redirect("/app/wheels");
  }

  const title = formData.get("title");
  const config = formData.get("config");
  const isActive = formData.get("isActive") === "true";
  const segmentsData = JSON.parse(formData.get("segments"));

  await db.wheel.update({
    where: { id: params.id },
    data: {
      title,
      config,
      isActive,
      segments: {
        deleteMany: {},
        create: segmentsData.map((segment) => ({
          label: segment.label,
          value: segment.value,
          probability: parseFloat(segment.probability || 0),
          color: segment.color,
        })),
      },
    },
  });

  return json({ success: true });
};

export default function WheelEditor() {
  const { wheel } = useLoaderData();
  const parsedConfig = useMemo(() => parseConfig(wheel.config), [wheel.config]);
  const logoInputRef = useRef(null);
  const backgroundInputRef = useRef(null);

  const [title, setTitle] = useState(wheel.title);
  const [isActive, setIsActive] = useState(wheel.isActive);
  const [segments, setSegments] = useState(wheel.segments);
  const [previewTab, setPreviewTab] = useState("initial");
  const [previewDevice, setPreviewDevice] = useState("mobile");
  const [colorsOpen, setColorsOpen] = useState(true);
  const [segmentTextColors, setSegmentTextColors] = useState(
    parsedConfig.segmentTextColors || {},
  );
  const [config, setConfig] = useState({
    style: getValidOptionValue(
      WHEEL_STYLE_OPTIONS,
      parsedConfig.style,
      "default",
    ),
    effect: getValidOptionValue(
      EFFECT_OPTIONS,
      parsedConfig.effect,
      "default",
    ),
    popupBehavior: parsedConfig.popupBehavior || "default",
    title: parsedConfig.title || "Spin & Win!",
    description:
      parsedConfig.description ||
      "Spin the wheel and unlock exclusive rewards instantly.",
    emailPlaceholder: parsedConfig.emailPlaceholder || "Enter your email",
    ctaText: parsedConfig.ctaText || "SPIN NOW",
    backgroundColor: normalizeHex(parsedConfig.backgroundColor, "#fff8f0"),
    headingColor: normalizeHex(parsedConfig.headingColor, "#8b4513"),
    textColor: normalizeHex(parsedConfig.textColor, "#3e2723"),
    buttonBackgroundColor: normalizeHex(
      parsedConfig.buttonBackgroundColor || parsedConfig.primaryColor,
      "#d2691e",
    ),
    buttonTextColor: normalizeHex(parsedConfig.buttonTextColor, "#ffffff"),
    wheelTextColor: normalizeHex(parsedConfig.wheelTextColor, "#4a1e00"),
    wheelCenterColor: normalizeHex(
      parsedConfig.wheelCenterColor || parsedConfig.primaryColor,
      "#f6b347",
    ),
    logoImageUrl: parsedConfig.logoImageUrl || "",
    backgroundImageUrl: parsedConfig.backgroundImageUrl || "",
    logoPosition: getValidOptionValue(
      LOGO_POSITION_OPTIONS,
      parsedConfig.logoPosition,
      "center_of_wheel",
    ),
  });

  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") !== "delete";

  const totalProbability = segments.reduce(
    (acc, segment) => acc + parseFloat(segment.probability || 0),
    0,
  );

  const wheelGradient = useMemo(() => buildWheelGradient(segments), [segments]);

  const handleConfigChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleStatusChange = (value) => {
    setIsActive(value === "active");
  };

  const handleSegmentColorChange = (index, value) => {
    setSegments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], color: normalizeHex(value, "#f6b347") };
      return next;
    });
  };

  const handleSegmentTextColorChange = (segmentId, value) => {
    setSegmentTextColors((prev) => ({
      ...prev,
      [segmentId]: normalizeHex(value, "#4a1e00"),
    }));
  };

  const handleLogoFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      handleConfigChange("logoImageUrl", dataUrl);
    } catch (error) {
      console.error(error);
    } finally {
      event.target.value = "";
    }
  };

  const handleBackgroundFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      handleConfigChange("backgroundImageUrl", dataUrl);
    } catch (error) {
      console.error(error);
    } finally {
      event.target.value = "";
    }
  };

  const showCenterLogo =
    Boolean(config.logoImageUrl) &&
    (config.logoPosition === "center_of_wheel" || config.logoPosition === "both");
  const showTopLogo =
    Boolean(config.logoImageUrl) &&
    (config.logoPosition === "top_of_popup" || config.logoPosition === "both");

  const handleSave = () => {
    submit(
      {
        title,
        isActive: String(isActive),
        config: JSON.stringify({ ...config, segmentTextColors }),
        segments: JSON.stringify(segments),
      },
      { method: "post" },
    );
  };

  return (
    <Page
      title={title}
      backAction={{ content: "Wheels", url: "/app/wheels" }}
      secondaryActions={[
        {
          content: "Preview",
          onAction: () => setPreviewTab("initial"),
        },
      ]}
    >
      <div className="WheelEditorLayout">
        <Layout>
        {totalProbability !== 100 && (
          <Layout.Section variant="fullWidth">
            <Banner tone="warning">
              Total probability is {totalProbability}%. It should ideally be 100%.
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <TextField
                  label="Wheel name"
                  value={title}
                  onChange={setTitle}
                  autoComplete="off"
                />

                <InlineGrid columns={2} gap="300">
                  <Select
                    label="Wheel style"
                    options={WHEEL_STYLE_OPTIONS}
                    value={config.style}
                    onChange={(value) => handleConfigChange("style", value)}
                  />
                  <Select
                    label="Effect"
                    options={EFFECT_OPTIONS}
                    value={config.effect}
                    onChange={(value) => handleConfigChange("effect", value)}
                  />
                </InlineGrid>

                <Select
                  label="Popup behavior"
                  options={POPUP_BEHAVIOR_OPTIONS}
                  value={config.popupBehavior}
                  onChange={(value) => handleConfigChange("popupBehavior", value)}
                  helpText="Choose how the spin wheel interaction works"
                />
              </BlockStack>
            </Card>

            <Card padding="0">
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <div>
                    <Text variant="headingMd" as="h2" fontWeight="bold">
                      Colors & Images
                    </Text>
                    <Text as="p" tone="subdued">
                      Adjust the colors and images used in the popup
                    </Text>
                  </div>
                  <Button
                    variant="plain"
                    icon={colorsOpen ? ChevronUpIcon : ChevronDownIcon}
                    onClick={() => setColorsOpen((open) => !open)}
                    accessibilityLabel="Toggle colors section"
                  />
                </InlineStack>
              </Box>

              <div
                style={{
                  maxHeight: colorsOpen ? "3400px" : "0px",
                  overflow: colorsOpen ? "visible" : "hidden",
                  opacity: colorsOpen ? 1 : 0,
                  transitionDuration: "500ms",
                  transitionTimingFunction: "ease-in-out",
                  transitionProperty: "max-height, opacity",
                  pointerEvents: colorsOpen ? "auto" : "none",
                }}
              >
                <Box padding="400" paddingBlockStart="0">
                  <InlineGrid columns={3} gap="300">
                    <ColorField
                      label="Background"
                      value={config.backgroundColor}
                      fallback="#fff8f0"
                      onChange={(value) =>
                        handleConfigChange("backgroundColor", normalizeHex(value, "#fff8f0"))
                      }
                    />
                    <ColorField
                      label="Heading"
                      value={config.headingColor}
                      fallback="#8b4513"
                      onChange={(value) =>
                        handleConfigChange("headingColor", normalizeHex(value, "#8b4513"))
                      }
                    />
                    <ColorField
                      label="Text"
                      value={config.textColor}
                      fallback="#3e2723"
                      onChange={(value) =>
                        handleConfigChange("textColor", normalizeHex(value, "#3e2723"))
                      }
                    />
                    <ColorField
                      label="Button background"
                      value={config.buttonBackgroundColor}
                      fallback="#d2691e"
                      onChange={(value) =>
                        handleConfigChange(
                          "buttonBackgroundColor",
                          normalizeHex(value, "#d2691e"),
                        )
                      }
                    />
                    <ColorField
                      label="Button text"
                      value={config.buttonTextColor}
                      fallback="#ffffff"
                      onChange={(value) =>
                        handleConfigChange("buttonTextColor", normalizeHex(value, "#ffffff"))
                      }
                    />
                  </InlineGrid>
                </Box>

                <Box borderBlockStartWidth="025" borderColor="border">
                  <Box padding="400" paddingBlockEnd="200">
                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Wheel colors
                    </Text>
                  </Box>

                  <Box padding="400" paddingBlockStart="0">
                    <InlineGrid columns={2} gap="300">
                      {segments.map((segment, index) => (
                        <div key={segment.id}>
                          <ColorField
                            label={`Slice ${index + 1} background`}
                            value={segment.color}
                            fallback="#f6b347"
                            onChange={(value) => handleSegmentColorChange(index, value)}
                          />
                          <div style={{ marginTop: "10px" }}>
                            <ColorField
                              label={`Slice ${index + 1} text`}
                              value={segmentTextColors[segment.id] || config.wheelTextColor}
                              fallback="#4a1e00"
                              onChange={(value) =>
                                handleSegmentTextColorChange(segment.id, value)
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </InlineGrid>
                  </Box>
                </Box>

                <Box borderBlockStartWidth="025" borderColor="border">
                  <Box padding="400">
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h3" fontWeight="semibold">
                        Logo & Background image
                      </Text>

                      <InlineStack gap="200">
                        <Button onClick={() => backgroundInputRef.current?.click()}>
                          {config.backgroundImageUrl ? "Change background image" : "Select background image"}
                        </Button>
                        {config.backgroundImageUrl ? (
                          <Button
                            tone="critical"
                            variant="plain"
                            onClick={() => handleConfigChange("backgroundImageUrl", "")}
                          >
                            Remove background
                          </Button>
                        ) : null}
                      </InlineStack>

                      {config.backgroundImageUrl ? (
                        <div
                          style={{
                            width: "120px",
                            height: "74px",
                            borderRadius: "8px",
                            border: "1px solid #d2d5d8",
                            backgroundImage: `url(${config.backgroundImageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        />
                      ) : null}

                      <InlineGrid columns={2} gap="300">
                        <div>
                          <Text as="p" variant="bodyMd" tone="subdued">
                            Logo image
                          </Text>
                          <div style={{ marginTop: "8px" }}>
                            <InlineStack gap="200" blockAlign="center">
                              {config.logoImageUrl ? (
                                <div
                                  style={{
                                    width: "34px",
                                    height: "34px",
                                    borderRadius: "50%",
                                    border: "1px solid #d2d5d8",
                                    background: "#fff",
                                    overflow: "hidden",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <img
                                    src={config.logoImageUrl}
                                    alt="Logo preview"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                </div>
                              ) : null}

                              {config.logoImageUrl ? (
                                <>
                                  <Button
                                    tone="critical"
                                    variant="plain"
                                    onClick={() => handleConfigChange("logoImageUrl", "")}
                                  >
                                    Remove logo
                                  </Button>
                                  <Button onClick={() => logoInputRef.current?.click()}>Change</Button>
                                </>
                              ) : (
                                <Button onClick={() => logoInputRef.current?.click()}>Select logo image</Button>
                              )}
                            </InlineStack>
                          </div>
                        </div>

                        <Select
                          label="Position of logo"
                          options={LOGO_POSITION_OPTIONS}
                          value={config.logoPosition}
                          onChange={(value) => handleConfigChange("logoPosition", value)}
                        />
                      </InlineGrid>

                      <input
                        ref={backgroundInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundFileChange}
                        style={{ display: "none" }}
                      />
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileChange}
                        style={{ display: "none" }}
                      />
                    </BlockStack>
                  </Box>
                </Box>
              </div>
            </Card>

            <Card>
              <InlineStack gap="300">
                <Button variant="primary" onClick={handleSave} loading={isSaving}>
                  Save changes
                </Button>
                <Button
                  tone="critical"
                  onClick={() => submit({ intent: "delete" }, { method: "post" })}
                >
                  Delete wheel
                </Button>
              </InlineStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
            <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2" fontWeight="bold">
                    Wheel Status
                  </Text>
                  {isActive ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="attention">Draft</Badge>
                  )}
                </InlineStack>

                <Select
                  labelHidden
                  label="Wheel status"
                  options={[
                    { label: "Active", value: "active" },
                    { label: "Draft", value: "draft" },
                  ]}
                  value={isActive ? "active" : "draft"}
                  onChange={handleStatusChange}
                />
              </BlockStack>
            </Card>

            <Card padding="0">
              <Box padding="400" paddingBlockEnd="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2" fontWeight="bold">
                    Preview
                  </Text>
                  <div
                    style={{
                      display: "inline-flex",
                      border: "1px solid #d2d5d8",
                      borderRadius: "10px",
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewDevice("mobile")}
                      style={{
                        border: "none",
                        borderRight: "1px solid #d2d5d8",
                        background: previewDevice === "mobile" ? "#303030" : "transparent",
                        color: previewDevice === "mobile" ? "#fff" : "#303030",
                        width: "30px",
                        height: "30px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                      aria-label="Mobile preview"
                    >
                      <Icon source={MobileIcon} tone={previewDevice === "mobile" ? "inherit" : "base"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice("desktop")}
                      style={{
                        border: "none",
                        background: previewDevice === "desktop" ? "#303030" : "transparent",
                        color: previewDevice === "desktop" ? "#fff" : "#303030",
                        width: "30px",
                        height: "30px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                      aria-label="Desktop preview"
                    >
                      <Icon source={DesktopIcon} tone={previewDevice === "desktop" ? "inherit" : "base"} />
                    </button>
                  </div>
                </InlineStack>

                <InlineStack gap="200">
                  {PREVIEW_TABS.map((tab) => (
                    <Button
                      key={tab.value}
                      size="slim"
                      variant={previewTab === tab.value ? "secondary" : "tertiary"}
                      onClick={() => setPreviewTab(tab.value)}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </InlineStack>
              </Box>

              <Box
                padding="400"
                borderBlockStartWidth="025"
                borderColor="border"
                background="bg-surface-secondary"
              >
                <div
                  style={{
                    margin: "0 auto",
                    maxWidth: previewDevice === "mobile" ? "300px" : "520px",
                    textAlign: "center",
                    padding: "12px",
                    borderRadius: "12px",
                    backgroundColor: config.backgroundColor,
                    backgroundImage: config.backgroundImageUrl
                      ? `url(${config.backgroundImageUrl})`
                      : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  {showTopLogo ? (
                    <div
                      style={{
                        margin: "0 auto 12px",
                        width: "58px",
                        height: "58px",
                        borderRadius: "50%",
                        border: "2px solid #fff",
                        overflow: "hidden",
                        background: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                      }}
                    >
                      <img
                        src={config.logoImageUrl}
                        alt="Wheel logo"
                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6px" }}
                      />
                    </div>
                  ) : null}

                  <div
                    style={{
                      margin: "8px auto 0",
                      width: previewDevice === "mobile" ? "220px" : "250px",
                      height: previewDevice === "mobile" ? "220px" : "250px",
                      borderRadius: "50%",
                      border: "6px solid #f1ad46",
                      background: wheelGradient,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        right: "-18px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        border: "4px solid #f1ad46",
                        background: "#fff",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "74px",
                        height: "74px",
                        borderRadius: "50%",
                        background: showCenterLogo ? "#fff" : config.wheelCenterColor,
                        border: "4px solid #ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        color: config.wheelTextColor,
                        fontWeight: 700,
                        fontSize: "16px",
                      }}
                  >
                    {showCenterLogo ? (
                      <img
                        src={config.logoImageUrl}
                        alt="Center logo"
                        style={{
                          width: "100%",
                          height: "100%",
                          padding: "8px",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      "SPIN"
                    )}
                  </div>
                  </div>

                  <div style={{ marginTop: "14px" }}>
                    <Text as="h3" variant="headingLg" fontWeight="bold" tone="base">
                      <span style={{ color: config.headingColor }}>{config.title}</span>
                    </Text>
                  </div>

                  <div style={{ marginTop: "6px" }}>
                    <Text as="p" tone="subdued">
                      <span style={{ color: config.textColor }}>
                        {previewTab === "initial"
                          ? config.description
                          : previewTab === "result"
                            ? "Congratulations! You unlocked a reward."
                            : previewTab === "side_button"
                              ? "Side button mode preview."
                              : "Countdown mode preview."}
                      </span>
                    </Text>
                  </div>

                  <div style={{ marginTop: "14px" }}>
                    <input
                      readOnly
                      value={config.emailPlaceholder}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        borderRadius: "10px",
                        border: "1px solid #d2d5d8",
                        padding: "11px 12px",
                        background: "#fff",
                        color: "#8c9196",
                        marginBottom: "12px",
                      }}
                    />
                    <button
                      type="button"
                      style={{
                        width: "100%",
                        border: "none",
                        borderRadius: "10px",
                        padding: "12px",
                        fontWeight: 700,
                        background: config.buttonBackgroundColor,
                        color: config.buttonTextColor,
                        cursor: "default",
                      }}
                    >
                      {config.ctaText}
                    </button>
                  </div>
                </div>
              </Box>
            </Card>
            </BlockStack>
        </Layout.Section>
        </Layout>
      </div>
    </Page>
  );
}
