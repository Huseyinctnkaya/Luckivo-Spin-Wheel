import { useEffect, useMemo, useRef, useState } from "react";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { SaveBar } from "@shopify/app-bridge-react";
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
  Checkbox,
  Icon,
  Modal,
  Popover,
  ColorPicker,
  hsbToHex,
  hexToRgb,
  rgbToHsb,
} from "@shopify/polaris";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DeleteIcon,
  DesktopIcon,
  MobileIcon,
  PlusIcon,
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

const TRIGGER_CONDITION_OPTIONS = [
  { label: "Show immediately", value: "show_immediately" },
  { label: "After delay", value: "after_delay" },
  { label: "On exit intent", value: "on_exit_intent" },
  { label: "After scroll", value: "after_scroll" },
];

const DISPLAY_ON_OPTIONS = [
  { label: "All pages", value: "all_pages" },
  { label: "Homepage only", value: "homepage_only" },
  { label: "Product pages", value: "product_pages" },
  { label: "Cart page", value: "cart_page" },
];

const DISPLAY_DAYS_OPTIONS = [
  { label: "Every day", value: "every_day" },
  { label: "Weekdays", value: "weekdays" },
  { label: "Weekends", value: "weekends" },
];

const DISCOUNT_ACTIVATION_TIME_OPTIONS = [
  { label: "Immediately", value: "immediately" },
  { label: "After 5 minutes", value: "after_5_minutes" },
  { label: "After 1 hour", value: "after_1_hour" },
];

const DISCOUNT_CODE_EXPIRATION_OPTIONS = [
  { label: "Never", value: "never" },
  { label: "In 24 hours", value: "in_24_hours" },
  { label: "In 3 days", value: "in_3_days" },
  { label: "In 7 days", value: "in_7_days" },
];

const SPIN_FREQUENCY_OPTIONS = [
  { label: "One time only", value: "one_time_only" },
  { label: "Once per day", value: "once_per_day" },
  { label: "Every visit", value: "every_visit" },
];

const SIDE_TRIGGER_TYPE_OPTIONS = [
  { label: "Text", value: "text" },
  { label: "Icon + text", value: "icon_text" },
];

const SIDE_TRIGGER_POSITION_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
];

const COUNTDOWN_POSITION_OPTIONS = [
  { label: "Top of the screen", value: "top_of_screen" },
  { label: "Bottom of the screen", value: "bottom_of_screen" },
];

const PREVIEW_TABS = [
  { label: "Initial", value: "initial" },
  { label: "Result", value: "result" },
  { label: "Side button", value: "side_button" },
  { label: "Countdown", value: "countdown" },
];

const CONTENT_TABS = [
  { label: "General", value: "general" },
  { label: "Success", value: "success" },
  { label: "No luck", value: "no_luck" },
  { label: "Errors", value: "errors" },
];

const DISCOUNT_TYPE_OPTIONS = [
  { label: "Percentage", value: "percentage" },
  { label: "Fixed amount", value: "fixed_amount" },
  { label: "Free shipping", value: "free_shipping" },
  { label: "No discount", value: "no_discount" },
];

const LOGO_POSITION_OPTIONS = [
  { label: "Center of wheel", value: "center_of_wheel" },
  { label: "Top of popup", value: "top_of_popup" },
  { label: "Both", value: "both" },
];

const EMAIL_REQUIREMENT_OPTIONS = [
  { label: "Required", value: "required" },
  { label: "Optional", value: "optional" },
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

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }
  return fallback;
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

  // When total > 0, exclude zero-probability segments from the gradient
  const visibleSegments = total > 0
    ? segments.filter((s) => Number(s.probability || 0) > 0)
    : segments;

  if (visibleSegments.length === 0) {
    return "conic-gradient(#f3f3f3 0deg 360deg)";
  }

  const visibleTotal = visibleSegments.reduce((sum, s) => {
    const p = Number(s.probability || 0);
    return sum + (Number.isFinite(p) ? p : 0);
  }, 0);

  const parts = [];
  let cursor = 0;

  visibleSegments.forEach((segment) => {
    const probability = Number(segment.probability || 0);
    const ratio =
      visibleTotal > 0
        ? probability / visibleTotal
        : 1 / visibleSegments.length;
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

function createSegmentId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `segment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatChance(probability) {
  const value = Number(probability);
  if (!Number.isFinite(value)) return "~0% chance";
  const safe = Math.max(0, value);
  const rounded = Number.isInteger(safe) ? safe.toFixed(0) : safe.toFixed(1);
  return `~${rounded}% chance`;
}

function buildDiscountDescription({
  discountType,
  discountAmount,
  minimumPurchase,
}) {
  if (discountType === "free_shipping") return "Free shipping";
  if (discountType === "no_discount") return "No discount";

  const amount = String(discountAmount || "0").trim() || "0";
  const minPurchase = String(minimumPurchase || "0").trim();
  const hasMin = Number(minPurchase) > 0;

  if (discountType === "fixed_amount") {
    return hasMin
      ? `$${amount} off (min. $${minPurchase})`
      : `$${amount} off`;
  }

  return `${amount}% discount`;
}

function formatPercentValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "0%";
  return Number.isInteger(parsed) ? `${parsed}%` : `${parsed.toFixed(2)}%`;
}

function buildPreviewRewardCode(segment) {
  if (!segment) return "PS123";
  const raw = `${segment.value || ""} ${segment.label || ""}`.toUpperCase();
  const normalized = raw.replace(/[^A-Z0-9]+/g, "").slice(0, 10);
  return normalized || "PS123";
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function createEditorSnapshot({ title, isActive, segments, config, segmentTextColors }) {
  const payload = {
    title,
    isActive,
    segments: (segments || []).map((segment) => ({
      id: segment.id,
      label: segment.label,
      value: segment.value,
      probability: Number(segment.probability || 0),
      color: segment.color ?? null,
    })),
    config: {
      ...(config || {}),
      segmentTextColors: segmentTextColors || {},
    },
  };

  return JSON.stringify(sortDeep(payload));
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
  const { session } = await authenticate.admin(request);
  const wheel = await db.wheel.findFirst({
    where: {
      id: params.id,
      shop: session.shop,
    },
    include: { segments: true },
  });

  if (!wheel) throw new Response("Not Found", { status: 404 });

  return json({ wheel });
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await db.wheel.deleteMany({
      where: {
        id: params.id,
        shop: session.shop,
      },
    });
    return redirect("/app/wheels");
  }

  const currentWheel = await db.wheel.findFirst({
    where: {
      id: params.id,
      shop: session.shop,
    },
    select: { id: true },
  });

  if (!currentWheel) {
    return json({ success: false, error: "Wheel not found." }, { status: 404 });
  }

  const title = formData.get("title");
  const config = formData.get("config");
  const isActive = formData.get("isActive") === "true";
  const segmentsData = JSON.parse(formData.get("segments"));

  if (isActive) {
    const activeConflict = await db.wheel.findFirst({
      where: {
        shop: session.shop,
        isActive: true,
        NOT: { id: currentWheel.id },
      },
      select: { title: true },
    });

    if (activeConflict) {
      return json(
        {
          success: false,
          error: `Another wheel is already active (${activeConflict.title}). Please deactivate it first.`,
        },
        { status: 409 },
      );
    }
  }

  await db.wheel.update({
    where: { id: currentWheel.id },
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
  const actionData = useActionData();
  const { wheel } = useLoaderData();
  const parsedConfig = useMemo(() => parseConfig(wheel.config), [wheel.config]);
  const logoInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const discountRowRefs = useRef({});
  const segmentsRef = useRef(wheel.segments);
  const draggedDiscountIndexRef = useRef(null);
  const dragOverDiscountIndexRef = useRef(null);

  const [title, setTitle] = useState(wheel.title);
  const [isActive, setIsActive] = useState(wheel.isActive);
  const [segments, setSegments] = useState(wheel.segments);
  const [previewTab, setPreviewTab] = useState("initial");
  const [previewDevice, setPreviewDevice] = useState("mobile");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(true);
  const [contentOpen, setContentOpen] = useState(true);
  const [contentTab, setContentTab] = useState("general");
  const [popupRulesOpen, setPopupRulesOpen] = useState(true);
  const [formFieldsOpen, setFormFieldsOpen] = useState(true);
  const [discountsOpen, setDiscountsOpen] = useState(true);
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
    triggerCondition: getValidOptionValue(
      TRIGGER_CONDITION_OPTIONS,
      parsedConfig.triggerCondition,
      "show_immediately",
    ),
    displayOn: getValidOptionValue(
      DISPLAY_ON_OPTIONS,
      parsedConfig.displayOn,
      "all_pages",
    ),
    displayOnDays: getValidOptionValue(
      DISPLAY_DAYS_OPTIONS,
      parsedConfig.displayOnDays,
      "every_day",
    ),
    hideOnMobileDevices: toBoolean(parsedConfig.hideOnMobileDevices, false),
    syncToShopifyCustomers: toBoolean(parsedConfig.syncToShopifyCustomers, true),
    discountActivationTime: getValidOptionValue(
      DISCOUNT_ACTIVATION_TIME_OPTIONS,
      parsedConfig.discountActivationTime,
      "immediately",
    ),
    discountCodeExpiration: getValidOptionValue(
      DISCOUNT_CODE_EXPIRATION_OPTIONS,
      parsedConfig.discountCodeExpiration,
      "never",
    ),
    spinFrequency: getValidOptionValue(
      SPIN_FREQUENCY_OPTIONS,
      parsedConfig.spinFrequency,
      "one_time_only",
    ),
    showSideTriggerButton: toBoolean(parsedConfig.showSideTriggerButton, false),
    sideTriggerType: getValidOptionValue(
      SIDE_TRIGGER_TYPE_OPTIONS,
      parsedConfig.sideTriggerType,
      "text",
    ),
    sideTriggerPosition: getValidOptionValue(
      SIDE_TRIGGER_POSITION_OPTIONS,
      parsedConfig.sideTriggerPosition,
      "left",
    ),
    sideTriggerButtonText: parsedConfig.sideTriggerButtonText || "💫 Get Discount",
    currencySymbol: parsedConfig.currencySymbol || "$",
    showCountdownAfterReveal: toBoolean(parsedConfig.showCountdownAfterReveal, false),
    countdownTimerText: parsedConfig.countdownTimerText || "Expires in",
    countdownPosition: getValidOptionValue(
      COUNTDOWN_POSITION_OPTIONS,
      parsedConfig.countdownPosition,
      "bottom_of_screen",
    ),
    initialHeading:
      parsedConfig.initialHeading ||
      parsedConfig.title ||
      "Spin & Win!",
    initialDescription:
      parsedConfig.initialDescription ||
      parsedConfig.description ||
      "Spin the wheel and unlock exclusive rewards instantly.",
    initialNamePlaceholder:
      parsedConfig.initialNamePlaceholder || "Enter your name",
    initialEmailPlaceholder:
      parsedConfig.initialEmailPlaceholder ||
      parsedConfig.emailPlaceholder ||
      "Enter your email",
    initialPhonePlaceholder:
      parsedConfig.initialPhonePlaceholder || "Enter your phone number",
    initialCtaText:
      parsedConfig.initialCtaText ||
      parsedConfig.ctaText ||
      "SPIN NOW",
    initialInfoText:
      parsedConfig.initialInfoText ||
      "By entering, you agree to receive updates and offers from our store.",
    resultHeading: parsedConfig.resultHeading || "🎁 You Won!",
    resultDescription:
      parsedConfig.resultDescription ||
      "Copy your code and enjoy your reward at checkout.",
    resultEmailSentText:
      parsedConfig.resultEmailSentText ||
      "Check your email for your discount code!",
    resultCopyCodeLabel: parsedConfig.resultCopyCodeLabel || "Copy Code",
    resultContinueButtonLabel:
      parsedConfig.resultContinueButtonLabel || "Continue Shopping",
    resultMinimumSpendLabel:
      parsedConfig.resultMinimumSpendLabel || "Minimum spend",
    noLuckHeading: parsedConfig.noLuckHeading || "🙈 Not This Time!",
    noLuckSubheading:
      parsedConfig.noLuckSubheading ||
      "Try again later — new rewards come often.",
    errorEmailInvalid:
      parsedConfig.errorEmailInvalid || "Please enter a valid email address",
    errorEmailAlreadyUsed:
      parsedConfig.errorEmailAlreadyUsed || "This email has already been used",
    errorFrequencyLimitExceeded:
      parsedConfig.errorFrequencyLimitExceeded ||
      "You have reached the limit for spinning the wheel",
    errorOneTimeOnly:
      parsedConfig.errorOneTimeOnly ||
      "You have reached the limit for spinning the wheel",
    errorTryAgainLater:
      parsedConfig.errorTryAgainLater ||
      "Please try again later when you are eligible.",
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
    discountSettings: parsedConfig.discountSettings || {},
    logoPosition: getValidOptionValue(
      LOGO_POSITION_OPTIONS,
      parsedConfig.logoPosition,
      "center_of_wheel",
    ),
    disableAllFormFields: toBoolean(parsedConfig.disableAllFormFields, false),
    showNameField: toBoolean(parsedConfig.showNameField, false),
    nameFieldRequirement: getValidOptionValue(
      EMAIL_REQUIREMENT_OPTIONS,
      parsedConfig.nameFieldRequirement,
      "required",
    ),
    showEmailField:
      parsedConfig.showEmailField === undefined
        ? true
        : toBoolean(parsedConfig.showEmailField, true),
    emailFieldRequirement: getValidOptionValue(
      EMAIL_REQUIREMENT_OPTIONS,
      parsedConfig.emailFieldRequirement,
      "required",
    ),
    showPhoneField: toBoolean(parsedConfig.showPhoneField, false),
    phoneFieldRequirement: getValidOptionValue(
      EMAIL_REQUIREMENT_OPTIONS,
      parsedConfig.phoneFieldRequirement,
      "required",
    ),
    showConsentCheckbox: toBoolean(parsedConfig.showConsentCheckbox, false),
  });
  const [editingDiscountIndex, setEditingDiscountIndex] = useState(null);
  const [discountDraft, setDiscountDraft] = useState(null);
  const [savedEditorState, setSavedEditorState] = useState(null);
  const pendingSaveStateRef = useRef(null);
  const [draggedDiscountIndex, setDraggedDiscountIndex] = useState(null);
  const [dragOverDiscountIndex, setDragOverDiscountIndex] = useState(null);

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
  const wheelSliceLabels = useMemo(() => {
    if (!segments.length) return [];

    const total = segments.reduce((sum, segment) => {
      const probability = Number(segment.probability || 0);
      return sum + (Number.isFinite(probability) ? probability : 0);
    }, 0);

    // Only show labels for segments that are visible on the wheel
    const visibleSegments = total > 0
      ? segments.filter((s) => Number(s.probability || 0) > 0)
      : segments;

    if (!visibleSegments.length) return [];

    const visibleTotal = visibleSegments.reduce((sum, s) => {
      const p = Number(s.probability || 0);
      return sum + (Number.isFinite(p) ? p : 0);
    }, 0);

    let cursor = 0;
    return visibleSegments.map((segment) => {
      const probability = Number(segment.probability || 0);
      const ratio = visibleTotal > 0 ? probability / visibleTotal : 1 / visibleSegments.length;
      const sweep = ratio * 360;
      const midAngle = cursor + sweep / 2;
      cursor += sweep;

      return {
        id: segment.id,
        label: String(segment.label || "").trim(),
        angle: midAngle,
        color: segmentTextColors[segment.id] || config.wheelTextColor,
      };
    });
  }, [segments, segmentTextColors, config.wheelTextColor]);

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

  const openDiscountEditor = (index) => {
    const target = segments[index];
    if (!target) return;
    const savedSettings = config.discountSettings?.[target.id] || {};

    setEditingDiscountIndex(index);
    setDiscountDraft({
      displayTitle: target.label || "",
      discountType: getValidOptionValue(
        DISCOUNT_TYPE_OPTIONS,
        savedSettings.discountType,
        "percentage",
      ),
      discountAmount: String(savedSettings.discountAmount ?? "10"),
      minimumPurchase: String(savedSettings.minimumPurchase ?? "0"),
      probabilityWeight: String(target.probability ?? 0),
      limitPrizeWins: Boolean(savedSettings.limitPrizeWins),
      maximumWinners: String(savedSettings.maximumWinners ?? "10"),
      currentWinners: String(savedSettings.currentWinners ?? "0"),
      customWinScreen: Boolean(savedSettings.customWinScreen),
      winScreenHeading: String(savedSettings.winScreenHeading ?? "Congrats! You won"),
      winScreenDescription: String(
        savedSettings.winScreenDescription ?? "Enjoy your reward and redeem it at checkout.",
      ),
      ctaButtonLabel: String(savedSettings.ctaButtonLabel ?? "Shop now"),
      ctaButtonUrl: String(savedSettings.ctaButtonUrl ?? "https://yourstore.com/collections/new"),
      combineOrderDiscounts: Boolean(savedSettings.combineOrderDiscounts),
      combineProductDiscounts: Boolean(savedSettings.combineProductDiscounts),
      combineShippingDiscounts: Boolean(savedSettings.combineShippingDiscounts),
    });
  };

  const closeDiscountEditor = () => {
    setEditingDiscountIndex(null);
    setDiscountDraft(null);
  };

  const handleDiscountDraftChange = (field, value) => {
    setDiscountDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleResetCurrentWinners = () => {
    setDiscountDraft((prev) => (prev ? { ...prev, currentWinners: "0" } : prev));
  };

  const handleSaveDiscountItem = () => {
    if (editingDiscountIndex === null || !discountDraft) return;

    const targetId = segments[editingDiscountIndex]?.id;
    const description = buildDiscountDescription(discountDraft);
    setSegments((prev) =>
      prev.map((segment, index) =>
        index === editingDiscountIndex
          ? {
              ...segment,
              label: discountDraft.displayTitle.trim() || "New item",
              value: description,
              probability: parseFloat(discountDraft.probabilityWeight || 0) || 0,
            }
          : segment,
      ),
    );

    if (targetId) {
      setConfig((current) => ({
        ...current,
        discountSettings: {
          ...(current.discountSettings || {}),
          [targetId]: {
            discountType: discountDraft.discountType,
            discountAmount: discountDraft.discountAmount,
            minimumPurchase: discountDraft.minimumPurchase,
            limitPrizeWins: discountDraft.limitPrizeWins,
            maximumWinners: discountDraft.maximumWinners,
            currentWinners: discountDraft.currentWinners,
            customWinScreen: discountDraft.customWinScreen,
            winScreenHeading: discountDraft.winScreenHeading,
            winScreenDescription: discountDraft.winScreenDescription,
            ctaButtonLabel: discountDraft.ctaButtonLabel,
            ctaButtonUrl: discountDraft.ctaButtonUrl,
            combineOrderDiscounts: discountDraft.combineOrderDiscounts,
            combineProductDiscounts: discountDraft.combineProductDiscounts,
            combineShippingDiscounts: discountDraft.combineShippingDiscounts,
          },
        },
      }));
    }

    closeDiscountEditor();
  };

  const handleDeleteDiscountItem = (index) => {
    const target = segments[index];
    if (!target) return;

    setSegments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setSegmentTextColors((prev) => {
      const next = { ...prev };
      delete next[target.id];
      return next;
    });
    setConfig((prev) => {
      const nextDiscountSettings = { ...(prev.discountSettings || {}) };
      delete nextDiscountSettings[target.id];
      return { ...prev, discountSettings: nextDiscountSettings };
    });

    if (editingDiscountIndex === index) {
      closeDiscountEditor();
    }
  };

  const handleAddDiscountItem = () => {
    const existingTotal = segments.reduce((sum, s) => sum + parseFloat(s.probability || 0), 0);
    const defaultProbability = segments.length > 0
      ? Math.max(1, Math.round(existingTotal / segments.length))
      : 10;

    const newSegment = {
      id: createSegmentId(),
      label: "New item",
      value: "Discount item",
      probability: defaultProbability,
      color: "#f6b347",
    };

    setSegments((prev) => [...prev, newSegment]);
    setSegmentTextColors((prev) => ({
      ...prev,
      [newSegment.id]: config.wheelTextColor,
    }));

    setEditingDiscountIndex(segments.length);
    setConfig((prev) => ({
      ...prev,
      discountSettings: {
        ...(prev.discountSettings || {}),
        [newSegment.id]: {
          discountType: "percentage",
          discountAmount: "10",
          minimumPurchase: "0",
          limitPrizeWins: false,
          maximumWinners: "10",
          currentWinners: "0",
          customWinScreen: false,
          winScreenHeading: "Congrats! You won",
          winScreenDescription: "Enjoy your reward and redeem it at checkout.",
          ctaButtonLabel: "Shop now",
          ctaButtonUrl: "https://yourstore.com/collections/new",
          combineOrderDiscounts: false,
          combineProductDiscounts: false,
          combineShippingDiscounts: false,
        },
      },
    }));
    setDiscountDraft({
      displayTitle: newSegment.label,
      discountType: "percentage",
      discountAmount: "10",
      minimumPurchase: "0",
      probabilityWeight: String(defaultProbability),
      limitPrizeWins: false,
      maximumWinners: "10",
      currentWinners: "0",
      customWinScreen: false,
      winScreenHeading: "Congrats! You won",
      winScreenDescription: "Enjoy your reward and redeem it at checkout.",
      ctaButtonLabel: "Shop now",
      ctaButtonUrl: "https://yourstore.com/collections/new",
      combineOrderDiscounts: false,
      combineProductDiscounts: false,
      combineShippingDiscounts: false,
    });
  };

  const handleDiscountDragStart = (event, index) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    draggedDiscountIndexRef.current = index;
    dragOverDiscountIndexRef.current = index;
    setDraggedDiscountIndex(index);
    setDragOverDiscountIndex(index);
  };

  const resetDiscountDragState = () => {
    dragOverDiscountIndexRef.current = null;
    draggedDiscountIndexRef.current = null;
    setDraggedDiscountIndex(null);
    setDragOverDiscountIndex(null);
  };

  const animateDiscountRowsReorder = (previousSegments, nextSegments, movingSegmentId) => {
    const previousRects = new Map();
    previousSegments.forEach((segment) => {
      const element = discountRowRefs.current[segment.id];
      if (element) {
        previousRects.set(segment.id, element.getBoundingClientRect());
      }
    });

    setSegments(nextSegments);
    segmentsRef.current = nextSegments;

    requestAnimationFrame(() => {
      nextSegments.forEach((segment) => {
        if (segment.id === movingSegmentId) return;
        const element = discountRowRefs.current[segment.id];
        const previous = previousRects.get(segment.id);
        if (!element || !previous) return;

        const current = element.getBoundingClientRect();
        const deltaX = previous.left - current.left;
        const deltaY = previous.top - current.top;

        if (deltaX === 0 && deltaY === 0) return;
        element.getAnimations().forEach((animation) => animation.cancel());
        element.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: "translate(0px, 0px)" },
          ],
          {
            duration: 220,
            easing: "cubic-bezier(0.2, 0, 0, 1)",
          },
        );
      });
    });
  };

  const remapEditingDiscountIndex = (current, fromIndex, toIndex) => {
    if (current === null) return null;
    if (current === fromIndex) return toIndex;
    if (fromIndex < toIndex && current > fromIndex && current <= toIndex) {
      return current - 1;
    }
    if (fromIndex > toIndex && current >= toIndex && current < fromIndex) {
      return current + 1;
    }
    return current;
  };

  const moveDiscountItem = (fromIndex, toIndex) => {
    const currentSegments = segmentsRef.current;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= currentSegments.length ||
      toIndex >= currentSegments.length ||
      fromIndex === toIndex
    ) {
      return false;
    }

    const nextSegments = [...currentSegments];
    const [movedSegment] = nextSegments.splice(fromIndex, 1);
    nextSegments.splice(toIndex, 0, movedSegment);

    animateDiscountRowsReorder(currentSegments, nextSegments, movedSegment?.id);
    setEditingDiscountIndex((current) =>
      remapEditingDiscountIndex(current, fromIndex, toIndex),
    );
    return true;
  };

  const handleDiscountDragOver = (event, index) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverDiscountIndexRef.current !== index) {
      dragOverDiscountIndexRef.current = index;
      setDragOverDiscountIndex(index);
    }
  };

  const handleDiscountDragEnter = (index) => {
    const fromIndex = draggedDiscountIndexRef.current;
    if (fromIndex === null || fromIndex === index) return;
    if (dragOverDiscountIndexRef.current === index) return;

    const moved = moveDiscountItem(fromIndex, index);
    if (moved) {
      draggedDiscountIndexRef.current = index;
      dragOverDiscountIndexRef.current = index;
      setDraggedDiscountIndex(index);
      setDragOverDiscountIndex(index);
    }
  };

  const handleDiscountDrop = (event) => {
    event.preventDefault();
    resetDiscountDragState();
  };

  const handleDiscountDragEnd = () => {
    resetDiscountDragState();
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
  const spinFirstMode = config.popupBehavior === "spin_first";
  const disableAllFields = toBoolean(config.disableAllFormFields, false);
  const shouldShowFormInputs = !spinFirstMode;
  const showEmailByConfig = toBoolean(config.showEmailField, true);
  const showNameInput =
    shouldShowFormInputs && !disableAllFields && toBoolean(config.showNameField, false);
  const showEmailInput =
    shouldShowFormInputs && (!disableAllFields && showEmailByConfig);
  const showPhoneInput =
    shouldShowFormInputs && !disableAllFields && toBoolean(config.showPhoneField, false);
  const showInfoText = shouldShowFormInputs;
  const previewResultSegment = segments[0] || null;
  const previewResultCode = buildPreviewRewardCode(previewResultSegment);
  const previewSideButtonText = config.sideTriggerButtonText || "💫 Get Discount";
  const previewCountdownTime = "11:07";
  const currentEditorState = useMemo(
    () => ({
      title,
      isActive,
      segments: deepClone(segments),
      config: deepClone(config),
      segmentTextColors: deepClone(segmentTextColors),
    }),
    [title, isActive, segments, config, segmentTextColors],
  );
  const currentSnapshot = useMemo(
    () => createEditorSnapshot(currentEditorState),
    [currentEditorState],
  );
  const savedSnapshot = useMemo(
    () => (savedEditorState ? createEditorSnapshot(savedEditorState) : null),
    [savedEditorState],
  );
  const isDirty = Boolean(savedSnapshot && currentSnapshot !== savedSnapshot);

  useEffect(() => {
    if (!savedEditorState) {
      setSavedEditorState(currentEditorState);
    }
  }, [savedEditorState, currentEditorState]);

  useEffect(() => {
    if (!actionData) return;

    if (actionData.success && pendingSaveStateRef.current) {
      setSavedEditorState(pendingSaveStateRef.current);
    }

    pendingSaveStateRef.current = null;
  }, [actionData]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const handleApplyCombinesToAll = () => {
    if (!discountDraft) return;

    setDiscountDraft((prev) =>
      prev
        ? {
            ...prev,
            combineOrderDiscounts: true,
            combineProductDiscounts: true,
            combineShippingDiscounts: true,
          }
        : prev,
    );

    setConfig((prev) => {
      const nextDiscountSettings = { ...(prev.discountSettings || {}) };
      segments.forEach((segment) => {
        const existing = nextDiscountSettings[segment.id] || {};
        nextDiscountSettings[segment.id] = {
          ...existing,
          combineOrderDiscounts: true,
          combineProductDiscounts: true,
          combineShippingDiscounts: true,
        };
      });
      return { ...prev, discountSettings: nextDiscountSettings };
    });
  };

  const handleSave = () => {
    pendingSaveStateRef.current = currentEditorState;
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

  const handleDiscard = () => {
    if (!savedEditorState) return;

    setTitle(savedEditorState.title);
    setIsActive(savedEditorState.isActive);
    setSegments(deepClone(savedEditorState.segments));
    setConfig(deepClone(savedEditorState.config));
    setSegmentTextColors(deepClone(savedEditorState.segmentTextColors));
    closeDiscountEditor();
  };

  const handleClosePreviewModal = () => {
    setPreviewModalOpen(false);
    setPreviewDevice("mobile");
  };

  const renderWheelPreview = ({ wheelSize, labelFontSize, labelWidth }) => (
    <div
      style={{
        margin: "8px auto 0",
        width: `${wheelSize}px`,
        height: `${wheelSize}px`,
        borderRadius: "50%",
        border: "6px solid #f1ad46",
        background: wheelGradient,
        position: "relative",
      }}
    >
      {wheelSliceLabels.map((slice) => {
        if (!slice.label) return null;
        const theta = (slice.angle * Math.PI) / 180;
        const radiusPercent = wheelSize >= 300 ? 36 : previewDevice === "mobile" ? 33 : 35;
        const x = 50 + radiusPercent * Math.sin(theta);
        const y = 50 - radiusPercent * Math.cos(theta);
        const normalizedAngle = ((slice.angle % 360) + 360) % 360;
        const textRotation =
          normalizedAngle > 90 && normalizedAngle < 270
            ? slice.angle + 180
            : slice.angle;

        return (
          <div
            key={slice.id}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) rotate(${textRotation}deg)`,
              color: slice.color,
              fontWeight: 700,
              fontSize: labelFontSize,
              lineHeight: 1.1,
              textAlign: "center",
              width: labelWidth,
              pointerEvents: "none",
              whiteSpace: "normal",
              overflowWrap: "break-word",
              textShadow: "0 1px 0 rgba(255,255,255,0.45)",
            }}
          >
            {slice.label}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          right: wheelSize >= 300 ? "-31px" : "-28px",
          top: "50%",
          transform: "translateY(-50%)",
          width: wheelSize >= 300 ? "44px" : "40px",
          height: wheelSize >= 300 ? "30px" : "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <svg width="44" height="30" viewBox="0 0 44 30" fill="none" aria-hidden="true">
          <path
            d="M2 15L18 4.5V25.5L2 15Z"
            fill="#ffffff"
            stroke="#f1ad46"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="30" cy="15" r="10" fill="#ffffff" stroke="#f1ad46" strokeWidth="4" />
          <circle cx="30" cy="15" r="3.4" fill="#f1ad46" />
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: wheelSize >= 300 ? "86px" : "74px",
          height: wheelSize >= 300 ? "86px" : "74px",
          borderRadius: "50%",
          background: showCenterLogo ? "#fff" : config.wheelCenterColor,
          border: "4px solid #ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          color: config.wheelTextColor,
          fontWeight: 700,
          fontSize: wheelSize >= 300 ? "18px" : "16px",
        }}
      >
        {showCenterLogo ? (
          <img
            src={config.logoImageUrl}
            alt="Center logo"
            style={{
              width: "100%",
              height: "100%",
              padding: wheelSize >= 300 ? "10px" : "8px",
              objectFit: "contain",
            }}
          />
        ) : (
          "SPIN"
        )}
      </div>
    </div>
  );

  const renderInitialContent = ({ desktopLayout = false } = {}) => (
    <>
      <div style={{ marginTop: desktopLayout ? "0" : "14px" }}>
        <Text as="h3" variant="headingLg" fontWeight="bold" tone="base">
          <span style={{ color: config.headingColor }}>{config.initialHeading}</span>
        </Text>
      </div>

      <div style={{ marginTop: "6px" }}>
        <Text as="p" tone="subdued">
          <span style={{ color: config.textColor }}>
            {config.initialDescription}
          </span>
        </Text>
      </div>

      <div style={{ marginTop: "14px" }}>
        {showNameInput ? (
          <input
            readOnly
            value={config.initialNamePlaceholder}
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
        ) : null}
        {showEmailInput ? (
          <input
            readOnly
            value={config.initialEmailPlaceholder}
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
        ) : null}
        {showPhoneInput ? (
          <input
            readOnly
            value={config.initialPhonePlaceholder}
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
        ) : null}
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
          {config.initialCtaText}
        </button>
        {showInfoText ? (
          <div style={{ marginTop: "10px", textAlign: "left" }}>
            <Text as="p" tone="subdued">
              <span style={{ color: config.textColor }}>
                {config.initialInfoText}
              </span>
            </Text>
          </div>
        ) : null}
      </div>
    </>
  );

  const renderResultContent = ({ desktopLayout = false } = {}) => (
    <>
      <div style={{ marginTop: desktopLayout ? "0" : "14px" }}>
        <Text as="h3" variant="headingLg" fontWeight="bold" tone="base">
          <span style={{ color: config.headingColor }}>{config.resultHeading}</span>
        </Text>
      </div>

      <div style={{ marginTop: "6px" }}>
        <Text as="p" tone="subdued">
          <span style={{ color: config.textColor }}>
            {config.resultDescription}
          </span>
        </Text>
      </div>

      <div style={{ marginTop: "4px" }}>
        <Text as="p" tone="subdued">
          <span style={{ color: config.textColor }}>
            {config.resultEmailSentText}
          </span>
        </Text>
      </div>

      {previewResultSegment ? (
        <div style={{ marginTop: "6px" }}>
          <Text as="p" tone="subdued">
            <span style={{ color: config.textColor }}>
              Reward: {previewResultSegment.label}
            </span>
          </Text>
        </div>
      ) : null}

      <div style={{ marginTop: "14px", display: "flex", alignItems: "stretch" }}>
        <div
          style={{
            flex: 1,
            border: `2px dashed ${config.buttonBackgroundColor}`,
            borderRight: "none",
            borderRadius: "10px 0 0 10px",
            background: "#fff",
            padding: "10px 12px",
            textAlign: "left",
            fontSize: desktopLayout ? "28px" : "32px",
            lineHeight: 1.1,
            color: "#303030",
          }}
        >
          {previewResultCode}
        </div>
        <button
          type="button"
          style={{
            border: "none",
            borderRadius: "0 10px 10px 0",
            padding: "0 16px",
            fontWeight: 700,
            background: config.buttonBackgroundColor,
            color: config.buttonTextColor,
            cursor: "default",
          }}
        >
          {config.resultCopyCodeLabel}
        </button>
      </div>

      <div style={{ marginTop: "12px" }}>
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
          {config.resultContinueButtonLabel}
        </button>
      </div>
    </>
  );

  const renderPreviewCanvas = ({ inModal = false } = {}) => {
    const isDesktopModalLayout = inModal && previewDevice === "desktop";
    const wheelSize =
      previewDevice === "mobile" ? 220 : isDesktopModalLayout ? 330 : 250;
    const labelFontSize =
      previewDevice === "mobile" ? "10px" : isDesktopModalLayout ? "14px" : "11px";
    const labelWidth =
      previewDevice === "mobile" ? "44px" : isDesktopModalLayout ? "72px" : "52px";

    return (
      <div
        style={{
          width: "100%",
          boxSizing: "border-box",
          textAlign: isDesktopModalLayout ? "left" : "center",
          padding: isDesktopModalLayout ? "16px 18px 20px" : "12px",
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
        {previewTab === "countdown" ? (
          <>
            {!config.showCountdownAfterReveal ? (
              <div
                style={{
                  marginBottom: "12px",
                  background: "#dbe7f3",
                  borderRadius: "10px",
                  padding: "12px",
                  textAlign: "left",
                }}
              >
                <Text as="p" variant="bodyMd">
                  Countdown timer is disabled in the settings.
                </Text>
                <div style={{ marginTop: "8px" }}>
                  <Button
                    size="slim"
                    onClick={() => handleConfigChange("showCountdownAfterReveal", true)}
                  >
                    Enable
                  </Button>
                </div>
              </div>
            ) : null}

            <div
              style={{
                position: "relative",
                width: previewDevice === "mobile" ? "100%" : inModal ? "620px" : "100%",
                maxWidth: "100%",
                margin: "0 auto",
                height: previewDevice === "mobile" ? "360px" : inModal ? "300px" : "440px",
                border: "1px solid #a7a7a7",
                borderRadius: "2px",
                background: "#f6f6f7",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  [config.countdownPosition === "top_of_screen" ? "top" : "bottom"]: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: config.buttonBackgroundColor,
                  color: config.buttonTextColor,
                  borderRadius: "10px",
                  padding: "8px 10px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {`${config.countdownTimerText} ${previewCountdownTime}`}
                </span>
                <span
                  style={{
                    border: `1px dashed ${config.buttonTextColor}`,
                    borderRadius: "4px",
                    padding: "2px 6px",
                    fontSize: "12px",
                  }}
                >
                  CODE
                </span>
                <span
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: `1px solid ${config.buttonTextColor}`,
                    background: "rgba(255,255,255,0.16)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    lineHeight: "14px",
                  }}
                >
                  ×
                </span>
              </div>
            </div>
          </>
        ) : previewTab === "side_button" ? (
          <>
            {!config.showSideTriggerButton ? (
              <div
                style={{
                  marginBottom: "12px",
                  background: "#dbe7f3",
                  borderRadius: "10px",
                  padding: "12px",
                  textAlign: "left",
                }}
              >
                <Text as="p" variant="bodyMd">
                  Side trigger button is disabled in the settings.
                </Text>
                <div style={{ marginTop: "8px" }}>
                  <Button
                    size="slim"
                    onClick={() => handleConfigChange("showSideTriggerButton", true)}
                  >
                    Enable
                  </Button>
                </div>
              </div>
            ) : null}

            <div
              style={{
                position: "relative",
                width: "100%",
                height: previewDevice === "mobile" ? "360px" : inModal ? "300px" : "440px",
                border: "1px solid #a7a7a7",
                borderRadius: "2px",
                background: "#f6f6f7",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  [config.sideTriggerPosition === "right" ? "right" : "left"]: "0",
                  transform: "translateY(-50%)",
                  width: "34px",
                  background: config.buttonBackgroundColor,
                  color: config.buttonTextColor,
                  borderRadius:
                    config.sideTriggerPosition === "right"
                      ? "10px 0 0 10px"
                      : "0 10px 10px 0",
                  padding: "8px 4px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <span style={{ fontSize: "18px", lineHeight: 1 }}>×</span>
                <span
                  style={{
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                    fontWeight: 600,
                    letterSpacing: "0.2px",
                  }}
                >
                  {previewSideButtonText}
                </span>
                {config.sideTriggerType === "icon_text" ? (
                  <span style={{ fontSize: "14px", lineHeight: 1 }}>↗</span>
                ) : null}
              </div>
            </div>
          </>
        ) : isDesktopModalLayout ? (
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "minmax(320px, 46%) minmax(340px, 54%)",
              gap: "28px",
              alignItems: "center",
              minHeight: "420px",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "4px",
                right: "8px",
                fontSize: "24px",
                color: "#303030",
                lineHeight: 1,
              }}
            >
              ×
            </span>
            <div>{renderWheelPreview({ wheelSize, labelFontSize, labelWidth })}</div>
            <div style={{ textAlign: "left", paddingRight: "10px" }}>
              {showTopLogo ? (
                <div
                  style={{
                    marginBottom: "12px",
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
              {previewTab === "result"
                ? renderResultContent({ desktopLayout: true })
                : renderInitialContent({ desktopLayout: true })}
            </div>
          </div>
        ) : (
          <>
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

            {renderWheelPreview({ wheelSize, labelFontSize, labelWidth })}
            {previewTab === "result"
              ? renderResultContent()
              : renderInitialContent()}
          </>
        )}
      </div>
    );
  };

  return (
    <Page
      title={title}
      backAction={{ content: "Wheels", url: "/app/wheels" }}
      secondaryActions={[
        {
          content: "Preview",
          onAction: () => {
            setPreviewTab("initial");
            setPreviewDevice("desktop");
            setPreviewModalOpen(true);
          },
        },
      ]}
    >
      <SaveBar open={isDirty}>
        <button variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button onClick={handleDiscard} disabled={isSaving}>
          Vazgeç
        </button>
      </SaveBar>

      <div className="WheelEditorLayout">
        <Layout>
        {actionData?.error ? (
          <Layout.Section variant="fullWidth">
            <Banner tone="critical">
              {actionData.error}
            </Banner>
          </Layout.Section>
        ) : null}
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
                      Popup Display Rules
                    </Text>
                    <Text as="p" tone="subdued">
                      Adjust the rules for when the popup should be displayed
                    </Text>
                  </div>
                  <Button
                    variant="plain"
                    icon={popupRulesOpen ? ChevronUpIcon : ChevronDownIcon}
                    onClick={() => setPopupRulesOpen((open) => !open)}
                    accessibilityLabel="Toggle popup rules section"
                  />
                </InlineStack>
              </Box>

              <div
                style={{
                  maxHeight: popupRulesOpen ? "2400px" : "0px",
                  overflow: popupRulesOpen ? "visible" : "hidden",
                  opacity: popupRulesOpen ? 1 : 0,
                  transitionDuration: "500ms",
                  transitionTimingFunction: "ease-in-out",
                  transitionProperty: "max-height, opacity",
                  pointerEvents: popupRulesOpen ? "auto" : "none",
                }}
              >
                <Box borderBlockStartWidth="025" borderColor="border" padding="400">
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center" gap="300">
                      <BlockStack gap="100" style={{ flex: 1, minWidth: 0 }}>
                        <Text as="p" variant="headingSm" fontWeight="semibold">
                          Add emails to Shopify Customers
                        </Text>
                        <Text as="p" tone="subdued">
                          Create/update customers in Shopify when visitors spin the wheel.
                        </Text>
                      </BlockStack>
                      <Checkbox
                        labelHidden
                        label="Add emails to Shopify Customers"
                        checked={config.syncToShopifyCustomers}
                        onChange={(checked) => handleConfigChange("syncToShopifyCustomers", checked)}
                      />
                    </InlineStack>

                    <Select
                      label="Trigger condition"
                      options={TRIGGER_CONDITION_OPTIONS}
                      value={config.triggerCondition}
                      onChange={(value) => handleConfigChange("triggerCondition", value)}
                    />
                    <Select
                      label="Display on"
                      options={DISPLAY_ON_OPTIONS}
                      value={config.displayOn}
                      onChange={(value) => handleConfigChange("displayOn", value)}
                    />
                    <Select
                      label="Display on days"
                      options={DISPLAY_DAYS_OPTIONS}
                      value={config.displayOnDays}
                      onChange={(value) => handleConfigChange("displayOnDays", value)}
                    />
                    <Checkbox
                      label="Hide on mobile devices"
                      checked={config.hideOnMobileDevices}
                      onChange={(checked) => handleConfigChange("hideOnMobileDevices", checked)}
                    />
                  </BlockStack>
                </Box>

                <Box borderBlockStartWidth="025" borderColor="border" padding="400">
                  <BlockStack gap="300">
                    <InlineGrid columns={2} gap="300">
                      <Select
                        label="Discount activation time"
                        options={DISCOUNT_ACTIVATION_TIME_OPTIONS}
                        value={config.discountActivationTime}
                        onChange={(value) =>
                          handleConfigChange("discountActivationTime", value)
                        }
                        helpText="When the discount code becomes active"
                      />
                      <Select
                        label="Discount code expiration"
                        options={DISCOUNT_CODE_EXPIRATION_OPTIONS}
                        value={config.discountCodeExpiration}
                        onChange={(value) =>
                          handleConfigChange("discountCodeExpiration", value)
                        }
                        helpText="When the discount code expires"
                      />
                    </InlineGrid>

                    <Select
                      label="Spin frequency"
                      options={SPIN_FREQUENCY_OPTIONS}
                      value={config.spinFrequency}
                      onChange={(value) => handleConfigChange("spinFrequency", value)}
                    />
                  </BlockStack>
                </Box>

                <Box borderBlockStartWidth="025" borderColor="border" padding="400">
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p">Show trigger button on the side of the screen</Text>
                      <Checkbox
                        labelHidden
                        label="Show trigger button on the side of the screen"
                        checked={config.showSideTriggerButton}
                        onChange={(checked) =>
                          handleConfigChange("showSideTriggerButton", checked)
                        }
                      />
                    </InlineStack>

                    {config.showSideTriggerButton ? (
                      <BlockStack gap="300">
                        <InlineGrid columns={2} gap="300">
                          <Select
                            label="Trigger type"
                            options={SIDE_TRIGGER_TYPE_OPTIONS}
                            value={config.sideTriggerType}
                            onChange={(value) => handleConfigChange("sideTriggerType", value)}
                          />
                          <Select
                            label="Position"
                            options={SIDE_TRIGGER_POSITION_OPTIONS}
                            value={config.sideTriggerPosition}
                            onChange={(value) => handleConfigChange("sideTriggerPosition", value)}
                          />
                        </InlineGrid>
                        <Text as="p" tone="subdued">
                          Button text is managed in Content → General.
                        </Text>
                      </BlockStack>
                    ) : null}
                  </BlockStack>
                </Box>

                <Box borderBlockStartWidth="025" borderColor="border" padding="400">
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="p">Show countdown timer after discount is revealed</Text>
                        <Badge tone="info">New</Badge>
                      </InlineStack>
                      <Checkbox
                        labelHidden
                        label="Show countdown timer after discount is revealed"
                        checked={config.showCountdownAfterReveal}
                        onChange={(checked) =>
                          handleConfigChange("showCountdownAfterReveal", checked)
                        }
                      />
                    </InlineStack>

                    {config.showCountdownAfterReveal ? (
                      <BlockStack gap="300">
                        <Select
                          label="Position"
                          options={COUNTDOWN_POSITION_OPTIONS}
                          value={config.countdownPosition}
                          onChange={(value) => handleConfigChange("countdownPosition", value)}
                        />
                        <Text as="p" tone="subdued">
                          Countdown text is managed in Content → Success.
                        </Text>
                      </BlockStack>
                    ) : null}
                  </BlockStack>
                </Box>
              </div>
            </Card>

            <Card padding="0">
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <div>
                    <Text variant="headingMd" as="h2" fontWeight="bold">
                      Form Fields Configuration
                    </Text>
                    <Text as="p" tone="subdued">
                      Adjust the form fields to be collected from the customer
                    </Text>
                  </div>
                  <Button
                    variant="plain"
                    icon={formFieldsOpen ? ChevronUpIcon : ChevronDownIcon}
                    onClick={() => setFormFieldsOpen((open) => !open)}
                    accessibilityLabel="Toggle form fields section"
                  />
                </InlineStack>
              </Box>

              <div
                style={{
                  maxHeight: formFieldsOpen ? "1200px" : "0px",
                  overflow: formFieldsOpen ? "visible" : "hidden",
                  opacity: formFieldsOpen ? 1 : 0,
                  transitionDuration: "500ms",
                  transitionTimingFunction: "ease-in-out",
                  transitionProperty: "max-height, opacity",
                  pointerEvents: formFieldsOpen ? "auto" : "none",
                }}
              >
                <Box borderBlockStartWidth="025" borderColor="border" padding="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p">Disable All Form Fields</Text>
                    <Checkbox
                      labelHidden
                      label="Disable All Form Fields"
                      checked={config.disableAllFormFields}
                      onChange={(checked) => handleConfigChange("disableAllFormFields", checked)}
                    />
                  </InlineStack>
                </Box>

                <Box borderBlockStartWidth="025" borderColor="border" padding="400">
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p" tone={config.disableAllFormFields ? "subdued" : undefined}>
                        Name Field
                      </Text>
                      <Checkbox
                        labelHidden
                        label="Name Field"
                        checked={config.showNameField}
                        disabled={config.disableAllFormFields}
                        onChange={(checked) => handleConfigChange("showNameField", checked)}
                      />
                    </InlineStack>

                    {config.showNameField && !config.disableAllFormFields ? (
                      <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                        <InlineGrid columns={2} gap="300">
                          <Select
                            label="Name field requirement"
                            options={EMAIL_REQUIREMENT_OPTIONS}
                            value={config.nameFieldRequirement || "required"}
                            onChange={(value) =>
                              handleConfigChange("nameFieldRequirement", value)
                            }
                          />
                          <TextField
                            label="Name placeholder text"
                            value={config.initialNamePlaceholder}
                            onChange={(value) =>
                              handleConfigChange("initialNamePlaceholder", value)
                            }
                            autoComplete="off"
                          />
                        </InlineGrid>
                      </Box>
                    ) : null}
                  </BlockStack>
                </Box>

                <Box borderBlockStartWidth="025" borderColor="border" padding="400">
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p" tone={config.disableAllFormFields ? "subdued" : undefined}>
                        Email Field
                      </Text>
                      <Checkbox
                        labelHidden
                        label="Email Field"
                        checked={config.showEmailField}
                        disabled={config.disableAllFormFields}
                        onChange={(checked) => handleConfigChange("showEmailField", checked)}
                      />
                    </InlineStack>

                    {config.showEmailField && !config.disableAllFormFields ? (
                      <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                        <InlineGrid columns={2} gap="300">
                          <Select
                            label="Email field requirement"
                            options={EMAIL_REQUIREMENT_OPTIONS}
                            value={config.emailFieldRequirement}
                            onChange={(value) =>
                              handleConfigChange("emailFieldRequirement", value)
                            }
                          />
                          <TextField
                            label="Email placeholder text"
                            value={config.initialEmailPlaceholder}
                            onChange={(value) =>
                              handleConfigChange("initialEmailPlaceholder", value)
                            }
                            autoComplete="off"
                          />
                        </InlineGrid>
                      </Box>
                    ) : null}
                  </BlockStack>
                </Box>

                <Box borderBlockStartWidth="025" borderColor="border" padding="400">
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p" tone={config.disableAllFormFields ? "subdued" : undefined}>
                        Phone Field
                      </Text>
                      <Checkbox
                        labelHidden
                        label="Phone Field"
                        checked={config.showPhoneField}
                        disabled={config.disableAllFormFields}
                        onChange={(checked) => handleConfigChange("showPhoneField", checked)}
                      />
                    </InlineStack>

                    {config.showPhoneField && !config.disableAllFormFields ? (
                      <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                        <InlineGrid columns={2} gap="300">
                          <Select
                            label="Phone field requirement"
                            options={EMAIL_REQUIREMENT_OPTIONS}
                            value={config.phoneFieldRequirement}
                            onChange={(value) =>
                              handleConfigChange("phoneFieldRequirement", value)
                            }
                          />
                          <TextField
                            label="Phone placeholder text"
                            value={config.initialPhonePlaceholder}
                            onChange={(value) =>
                              handleConfigChange("initialPhonePlaceholder", value)
                            }
                            autoComplete="off"
                          />
                        </InlineGrid>
                      </Box>
                    ) : null}
                  </BlockStack>
                </Box>

                <Box borderBlockStartWidth="025" borderColor="border" padding="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" tone={config.disableAllFormFields ? "subdued" : undefined}>
                      Consent Checkbox
                    </Text>
                    <Checkbox
                      labelHidden
                      label="Consent Checkbox"
                      checked={config.showConsentCheckbox}
                      disabled={config.disableAllFormFields}
                      onChange={(checked) => handleConfigChange("showConsentCheckbox", checked)}
                    />
                  </InlineStack>
                </Box>
              </div>
            </Card>

            <Card padding="0">
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <div>
                    <Text variant="headingMd" as="h2" fontWeight="bold">
                      Content
                    </Text>
                    <Text as="p" tone="subdued">
                      Edit text content for the popup
                    </Text>
                  </div>
                  <Button
                    variant="plain"
                    icon={contentOpen ? ChevronUpIcon : ChevronDownIcon}
                    onClick={() => setContentOpen((open) => !open)}
                    accessibilityLabel="Toggle content section"
                  />
                </InlineStack>
              </Box>

              <div
                style={{
                  maxHeight: contentOpen ? "2200px" : "0px",
                  overflow: contentOpen ? "visible" : "hidden",
                  opacity: contentOpen ? 1 : 0,
                  transitionDuration: "500ms",
                  transitionTimingFunction: "ease-in-out",
                  transitionProperty: "max-height, opacity",
                  pointerEvents: contentOpen ? "auto" : "none",
                }}
              >
                <Box borderBlockStartWidth="025" borderColor="border" padding="400">
                  <BlockStack gap="300">
                    <InlineStack gap="200">
                      {CONTENT_TABS.map((tab) => (
                        <Button
                          key={tab.value}
                          size="slim"
                          variant={contentTab === tab.value ? "secondary" : "tertiary"}
                          onClick={() => setContentTab(tab.value)}
                        >
                          {tab.label}
                        </Button>
                      ))}
                    </InlineStack>

                    {contentTab === "general" ? (
                      <BlockStack gap="300">
                        <TextField
                          label="Currency"
                          value={config.currencySymbol}
                          onChange={(value) => handleConfigChange("currencySymbol", value)}
                          autoComplete="off"
                        />
                        <TextField
                          label="Heading"
                          value={config.initialHeading}
                          onChange={(value) => handleConfigChange("initialHeading", value)}
                          autoComplete="off"
                        />
                        <TextField
                          label="Subheading"
                          value={config.initialDescription}
                          onChange={(value) => handleConfigChange("initialDescription", value)}
                          autoComplete="off"
                        />
                        <TextField
                          label="Email placeholder"
                          value={config.initialEmailPlaceholder}
                          onChange={(value) =>
                            handleConfigChange("initialEmailPlaceholder", value)
                          }
                          autoComplete="off"
                        />
                        <TextField
                          label="Button text"
                          value={config.initialCtaText}
                          onChange={(value) => handleConfigChange("initialCtaText", value)}
                          autoComplete="off"
                        />
                        <Box borderBlockStartWidth="025" borderColor="border" paddingBlockStart="300">
                          <BlockStack gap="300">
                            <TextField
                              label="Info text"
                              value={config.initialInfoText}
                              onChange={(value) => handleConfigChange("initialInfoText", value)}
                              autoComplete="off"
                            />
                            <TextField
                              label="Side trigger button text"
                              value={config.sideTriggerButtonText}
                              onChange={(value) => handleConfigChange("sideTriggerButtonText", value)}
                              autoComplete="off"
                            />
                          </BlockStack>
                        </Box>
                      </BlockStack>
                    ) : null}

                    {contentTab === "success" ? (
                      <BlockStack gap="300">
                        <TextField
                          label="Heading"
                          value={config.resultHeading}
                          onChange={(value) => handleConfigChange("resultHeading", value)}
                          autoComplete="off"
                        />
                        <TextField
                          label="Subheading"
                          value={config.resultDescription}
                          onChange={(value) => handleConfigChange("resultDescription", value)}
                          autoComplete="off"
                        />
                        <TextField
                          label="Email sent text"
                          value={config.resultEmailSentText}
                          onChange={(value) => handleConfigChange("resultEmailSentText", value)}
                          helpText="Check out the 'Email' page to enable this setting."
                          autoComplete="off"
                        />
                        <Box borderBlockStartWidth="025" borderColor="border" paddingBlockStart="300">
                          <InlineGrid columns={2} gap="300">
                            <TextField
                              label="Copy code"
                              value={config.resultCopyCodeLabel}
                              onChange={(value) => handleConfigChange("resultCopyCodeLabel", value)}
                              autoComplete="off"
                            />
                            <TextField
                              label="Continue shopping"
                              value={config.resultContinueButtonLabel}
                              onChange={(value) =>
                                handleConfigChange("resultContinueButtonLabel", value)
                              }
                              autoComplete="off"
                            />
                          </InlineGrid>
                        </Box>
                        <TextField
                          label="Minimum spend label"
                          value={config.resultMinimumSpendLabel}
                          onChange={(value) => handleConfigChange("resultMinimumSpendLabel", value)}
                          autoComplete="off"
                        />
                        <TextField
                          label="Expires in label"
                          value={config.countdownTimerText}
                          onChange={(value) => handleConfigChange("countdownTimerText", value)}
                          autoComplete="off"
                        />
                      </BlockStack>
                    ) : null}

                    {contentTab === "no_luck" ? (
                      <BlockStack gap="300">
                        <TextField
                          label="Heading"
                          value={config.noLuckHeading}
                          onChange={(value) => handleConfigChange("noLuckHeading", value)}
                          autoComplete="off"
                        />
                        <TextField
                          label="Subheading"
                          value={config.noLuckSubheading}
                          onChange={(value) => handleConfigChange("noLuckSubheading", value)}
                          autoComplete="off"
                        />
                      </BlockStack>
                    ) : null}

                    {contentTab === "errors" ? (
                      <BlockStack gap="300">
                        <TextField
                          label="Email invalid"
                          value={config.errorEmailInvalid}
                          onChange={(value) => handleConfigChange("errorEmailInvalid", value)}
                          autoComplete="off"
                        />
                        <TextField
                          label="Email already used"
                          value={config.errorEmailAlreadyUsed}
                          onChange={(value) => handleConfigChange("errorEmailAlreadyUsed", value)}
                          autoComplete="off"
                        />
                        <Box borderBlockStartWidth="025" borderColor="border" paddingBlockStart="300">
                          <BlockStack gap="300">
                            <TextField
                              label="Frequency limit exceeded"
                              value={config.errorFrequencyLimitExceeded}
                              onChange={(value) =>
                                handleConfigChange("errorFrequencyLimitExceeded", value)
                              }
                              autoComplete="off"
                            />
                            <TextField
                              label="One time only message"
                              value={config.errorOneTimeOnly}
                              onChange={(value) => handleConfigChange("errorOneTimeOnly", value)}
                              autoComplete="off"
                            />
                            <TextField
                              label="Try again later message"
                              value={config.errorTryAgainLater}
                              onChange={(value) => handleConfigChange("errorTryAgainLater", value)}
                              autoComplete="off"
                            />
                          </BlockStack>
                        </Box>
                      </BlockStack>
                    ) : null}
                  </BlockStack>
                </Box>
              </div>
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

            <Card padding="0">
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <div>
                    <Text variant="headingMd" as="h2" fontWeight="bold">
                      Discounts Settings
                    </Text>
                    <Text as="p" tone="subdued">
                      Adjust the discounts settings
                    </Text>
                  </div>
                  <Button
                    variant="plain"
                    icon={discountsOpen ? ChevronUpIcon : ChevronDownIcon}
                    onClick={() => setDiscountsOpen((open) => !open)}
                    accessibilityLabel="Toggle discounts section"
                  />
                </InlineStack>
              </Box>

              <div
                style={{
                  maxHeight: discountsOpen ? "1800px" : "0px",
                  overflow: discountsOpen ? "visible" : "hidden",
                  opacity: discountsOpen ? 1 : 0,
                  transitionDuration: "500ms",
                  transitionTimingFunction: "ease-in-out",
                  transitionProperty: "max-height, opacity",
                  pointerEvents: discountsOpen ? "auto" : "none",
                }}
              >
                <div
                  style={{
                    borderTop: "1px solid #e3e3e3",
                    borderBottom: "1px solid #e3e3e3",
                  }}
                >
                  {segments.length === 0 ? (
                    <Box padding="400">
                      <Text as="p" tone="subdued">
                        No discount item yet.
                      </Text>
                    </Box>
                  ) : (
                    segments.map((segment, index) => (
                      <div
                        key={segment.id}
                        ref={(node) => {
                          if (node) {
                            discountRowRefs.current[segment.id] = node;
                          } else {
                            delete discountRowRefs.current[segment.id];
                          }
                        }}
                        className={
                          index === draggedDiscountIndex
                            ? "DiscountItemRow DiscountItemRow--dragging"
                            : index === dragOverDiscountIndex
                              ? "DiscountItemRow DiscountItemRow--over"
                              : "DiscountItemRow"
                        }
                        onDragOver={(event) => handleDiscountDragOver(event, index)}
                        onDragEnter={() => handleDiscountDragEnter(index)}
                        onDrop={handleDiscountDrop}
                        style={{
                          padding: "16px",
                          borderTop: index === 0 ? "none" : "1px solid #e3e3e3",
                        }}
                      >
                        <InlineStack gap="300" blockAlign="center" wrap={false}>
                          <button
                            type="button"
                            className="DiscountItemDragHandle"
                            draggable
                            onDragStart={(event) => handleDiscountDragStart(event, index)}
                            onDragEnd={handleDiscountDragEnd}
                            aria-label={`Drag ${segment.label || "discount item"}`}
                          >
                            <span className="DiscountItemDragHandleDots" aria-hidden="true">
                              {Array.from({ length: 6 }).map((_, dotIndex) => (
                                <span key={dotIndex} />
                              ))}
                            </span>
                          </button>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <InlineStack align="space-between" blockAlign="center" wrap={false}>
                              <div>
                                <Text as="p" variant="headingSm" fontWeight="semibold">
                                  {segment.label || "Untitled"}
                                </Text>
                                <Text as="p" tone="subdued">
                                  {`${segment.value || "Discount item"} • ${formatChance(segment.probability)}`}
                                </Text>
                              </div>
                              <InlineStack gap="200" blockAlign="center">
                                <Button size="slim" variant="secondary" onClick={() => openDiscountEditor(index)}>
                                  Edit
                                </Button>
                                <Button
                                  size="slim"
                                  variant="secondary"
                                  tone="critical"
                                  icon={DeleteIcon}
                                  accessibilityLabel={`Delete ${segment.label || "discount item"}`}
                                  onClick={() => handleDeleteDiscountItem(index)}
                                />
                              </InlineStack>
                            </InlineStack>
                          </div>
                        </InlineStack>
                      </div>
                    ))
                  )}
                </div>

                <Box padding="400">
                  <InlineStack align="center">
                    <Button icon={PlusIcon} onClick={handleAddDiscountItem}>
                      Add Discount Item
                    </Button>
                  </InlineStack>
                </Box>
              </div>
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
                      onClick={() => {
                        setPreviewDevice("desktop");
                        setPreviewModalOpen(true);
                      }}
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
              >
                {renderPreviewCanvas()}
              </Box>
            </Card>
            </BlockStack>
        </Layout.Section>
        </Layout>
      </div>

      <Modal
        open={previewModalOpen}
        onClose={handleClosePreviewModal}
        title="Preview"
        size="large"
      >
        <Modal.Section>
          <BlockStack gap="300">
            <InlineStack gap="200">
              {PREVIEW_TABS.map((tab) => (
                <Button
                  key={`modal-${tab.value}`}
                  size="slim"
                  variant={previewTab === tab.value ? "secondary" : "tertiary"}
                  onClick={() => setPreviewTab(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </InlineStack>

            {renderPreviewCanvas({ inModal: true })}
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={editingDiscountIndex !== null && Boolean(discountDraft)}
        onClose={closeDiscountEditor}
        title={`Edit Discount ${(editingDiscountIndex ?? 0) + 1}`}
        primaryAction={{
          content: "Done",
          onAction: handleSaveDiscountItem,
        }}
      >
        <Modal.Section>
          {discountDraft ? (
            <BlockStack gap="300">
              <TextField
                label="Display Title"
                value={discountDraft.displayTitle}
                onChange={(value) => handleDiscountDraftChange("displayTitle", value)}
                autoComplete="off"
              />

              <InlineGrid columns={2} gap="300">
                <Select
                  label="Discount Type"
                  options={DISCOUNT_TYPE_OPTIONS}
                  value={discountDraft.discountType}
                  onChange={(value) => handleDiscountDraftChange("discountType", value)}
                />
                <TextField
                  type="number"
                  label="Discount Amount"
                  value={discountDraft.discountAmount}
                  suffix={discountDraft.discountType === "percentage" ? "%" : undefined}
                  prefix={discountDraft.discountType === "fixed_amount" ? "$" : undefined}
                  disabled={
                    discountDraft.discountType === "free_shipping" ||
                    discountDraft.discountType === "no_discount"
                  }
                  onChange={(value) => handleDiscountDraftChange("discountAmount", value)}
                  autoComplete="off"
                />
              </InlineGrid>

              <InlineGrid columns={2} gap="300">
                <TextField
                  type="number"
                  label="Minimum Purchase"
                  prefix="$"
                  value={discountDraft.minimumPurchase}
                  onChange={(value) => handleDiscountDraftChange("minimumPurchase", value)}
                  autoComplete="off"
                />
                <TextField
                  type="number"
                  label="Probability Weight"
                  value={discountDraft.probabilityWeight}
                  onChange={(value) => handleDiscountDraftChange("probabilityWeight", value)}
                  autoComplete="off"
                />
              </InlineGrid>

              <Checkbox
                label="Limit number of times this prize can be won"
                checked={discountDraft.limitPrizeWins}
                onChange={(checked) => handleDiscountDraftChange("limitPrizeWins", checked)}
              />

              {discountDraft.limitPrizeWins ? (
                <BlockStack gap="200">
                  <TextField
                    type="number"
                    label="Maximum Winners"
                    value={discountDraft.maximumWinners}
                    onChange={(value) => handleDiscountDraftChange("maximumWinners", value)}
                    autoComplete="off"
                    placeholder="e.g. 10"
                  />
                  <Text as="p" tone="subdued">
                    The total number of times this prize can be won across all users.
                  </Text>
                  <InlineStack gap="300" blockAlign="center">
                    <Text as="p" tone="subdued">
                      {`Current winners: ${discountDraft.currentWinners || "0"}`}
                    </Text>
                    <Button variant="plain" tone="critical" onClick={handleResetCurrentWinners}>
                      Reset
                    </Button>
                  </InlineStack>
                </BlockStack>
              ) : null}

              <Box
                background="bg-surface-info"
                borderRadius="200"
                padding="300"
                borderColor="border"
              >
                <Text as="p" tone="info">
                  {`Approximately ${formatPercentValue(discountDraft.probabilityWeight)} chance of winning`}
                </Text>
              </Box>

              <BlockStack gap="200">
                <Checkbox
                  label="Use custom win screen for this discount"
                  checked={discountDraft.customWinScreen}
                  onChange={(checked) => handleDiscountDraftChange("customWinScreen", checked)}
                />
                <Box paddingInlineStart="500">
                  <Text as="p" tone="subdued">
                    When enabled, shoppers will see a custom win screen after winning this prize.
                  </Text>
                </Box>

                {discountDraft.customWinScreen ? (
                  <>
                    <TextField
                      label="Win screen heading"
                      value={discountDraft.winScreenHeading}
                      onChange={(value) => handleDiscountDraftChange("winScreenHeading", value)}
                      autoComplete="off"
                    />
                    <TextField
                      label="Win screen description"
                      value={discountDraft.winScreenDescription}
                      onChange={(value) =>
                        handleDiscountDraftChange("winScreenDescription", value)
                      }
                      autoComplete="off"
                      multiline={4}
                    />
                    <InlineGrid columns={2} gap="300">
                      <TextField
                        label="CTA button label"
                        value={discountDraft.ctaButtonLabel}
                        onChange={(value) => handleDiscountDraftChange("ctaButtonLabel", value)}
                        autoComplete="off"
                      />
                      <TextField
                        label="CTA button URL"
                        value={discountDraft.ctaButtonUrl}
                        onChange={(value) => handleDiscountDraftChange("ctaButtonUrl", value)}
                        autoComplete="off"
                      />
                    </InlineGrid>
                  </>
                ) : null}
              </BlockStack>

              <Box borderBlockStartWidth="025" borderColor="border" paddingBlockStart="300">
                <InlineStack align="space-between" blockAlign="center">
                  <div>
                    <Text as="h4" variant="headingSm" fontWeight="semibold">
                      Combines With
                    </Text>
                    <Text as="p" tone="subdued">
                      Choose which discount types this discount can be combined with.
                    </Text>
                  </div>
                  <Button variant="plain" onClick={handleApplyCombinesToAll}>
                    Apply to all items
                  </Button>
                </InlineStack>
              </Box>

              <InlineStack gap="400">
                <Checkbox
                  label="Order discounts"
                  checked={discountDraft.combineOrderDiscounts}
                  onChange={(checked) => handleDiscountDraftChange("combineOrderDiscounts", checked)}
                />
                <Checkbox
                  label="Product discounts"
                  checked={discountDraft.combineProductDiscounts}
                  onChange={(checked) => handleDiscountDraftChange("combineProductDiscounts", checked)}
                />
                <Checkbox
                  label="Shipping discounts"
                  checked={discountDraft.combineShippingDiscounts}
                  onChange={(checked) => handleDiscountDraftChange("combineShippingDiscounts", checked)}
                />
              </InlineStack>
            </BlockStack>
          ) : null}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
