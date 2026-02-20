(function () {
  const root = document.getElementById("lucky-wheel-root");
  if (!root) return;

  const proxyUrl = root.dataset.proxyUrl;
  const overlay = document.getElementById("lucky-wheel-overlay");
  const modal = document.querySelector(".lucky-wheel-modal");
  const titleEl = document.getElementById("lucky-wheel-title");
  const descriptionEl = document.getElementById("lucky-wheel-description");
  const infoTextEl = document.getElementById("lucky-wheel-info-text");
  const closeBtn = document.getElementById("lucky-wheel-close");
  const spinBtn = document.getElementById("lucky-wheel-spin-btn");
  const nameInput = document.getElementById("lucky-wheel-name");
  const emailInput = document.getElementById("lucky-wheel-email");
  const phoneInput = document.getElementById("lucky-wheel-phone");
  const consentRowEl = document.getElementById("lucky-wheel-consent-row");
  const consentCheckbox = document.getElementById("lucky-wheel-consent-checkbox");
  const formErrorEl = document.getElementById("lucky-wheel-error");
  const form = document.getElementById("lucky-wheel-form");
  const resultDiv = document.getElementById("lucky-wheel-result");
  const resultHeadingEl = document.getElementById("lucky-wheel-result-heading");
  const resultDescriptionEl = document.getElementById("lucky-wheel-result-description");
  const resultEmailSentEl = document.getElementById("lucky-wheel-result-email-sent");
  const resultRewardEl = document.getElementById("lucky-wheel-result-reward");
  const codeRowEl = document.getElementById("lucky-wheel-code-row");
  const couponEl = document.getElementById("lucky-wheel-coupon");
  const copyBtn = document.getElementById("lucky-wheel-copy-btn");
  const continueBtn = document.getElementById("lucky-wheel-continue-btn");
  const topLogoEl = document.getElementById("lucky-wheel-top-logo");
  const topLogoImg = document.getElementById("lucky-wheel-top-logo-img");
  const centerLogoEl = document.getElementById("lucky-wheel-center-logo");
  const centerLogoImg = document.getElementById("lucky-wheel-center-logo-img");
  const canvas = document.getElementById("wheel-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;

  if (!overlay || !modal || !spinBtn || !emailInput || !canvas || !ctx) return;

  let wheelConfig = null;
  let wheelSettings = {};
  let isSpinning = false;
  let currentRotation = 0;
  let sideTriggerEl = null;
  let sideTriggerLabelEl = null;
  let sideTriggerIconEl = null;
  let countdownEl = null;
  let countdownTimeEl = null;
  let countdownCodeEl = null;
  let countdownCloseEl = null;
  let countdownInterval = null;

  const POINTER_BORDER_COLOR = "#f1ad46";
  const DEFAULT_WHEEL_TEXT_COLOR = "#4a1e00";
  const DEFAULT_CENTER_COLOR = "#6c5ce7";

  function normalizeDegree(value) {
    const normalized = value % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function parseWheelSettings(rawConfig) {
    try {
      const parsed = JSON.parse(rawConfig || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function getSetting(keys, fallback) {
    for (const key of keys) {
      const value = wheelSettings[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
    return fallback;
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

  function getSegments() {
    return Array.isArray(wheelConfig?.segments) ? wheelConfig.segments : [];
  }

  function isMobileViewport() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function normalizedPathname() {
    return (window.location.pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
  }

  function isHomePath(pathname) {
    if (pathname === "/") return true;
    const parts = pathname.split("/").filter(Boolean);
    return parts.length === 1 && /^[a-z]{2}(?:-[a-z]{2})?$/.test(parts[0]);
  }

  function isDisplayPageAllowed() {
    const displayOn = getSetting(["displayOn"], "all_pages");
    const path = normalizedPathname();

    switch (displayOn) {
      case "homepage_only":
        return isHomePath(path);
      case "product_pages":
        return path.includes("/products/");
      case "cart_page":
        return path === "/cart" || path.endsWith("/cart");
      case "all_pages":
      default:
        return true;
    }
  }

  function isDisplayDayAllowed() {
    const displayOnDays = getSetting(["displayOnDays"], "every_day");
    const day = new Date().getDay();

    if (displayOnDays === "weekdays") return day >= 1 && day <= 5;
    if (displayOnDays === "weekends") return day === 0 || day === 6;
    return true;
  }

  function getVisitorStorageKey() {
    if (!wheelConfig?.id) return null;
    return `luckivo-wheel:${window.location.hostname}:${wheelConfig.id}`;
  }

  function readVisitorState() {
    const key = getVisitorStorageKey();
    if (!key) return {};

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeVisitorState(nextState) {
    const key = getVisitorStorageKey();
    if (!key) return;

    try {
      localStorage.setItem(key, JSON.stringify(nextState));
    } catch {
      // Ignore storage failures (private mode / blocked storage).
    }
  }

  function sameLocalDay(dateA, dateB) {
    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate()
    );
  }

  function isSpinAllowed(showError = false) {
    const mode = getSetting(["spinFrequency"], "one_time_only");
    const state = readVisitorState();
    const lastSpinAt = state?.lastSpinAt ? new Date(state.lastSpinAt) : null;

    let allowed = true;
    if (mode === "one_time_only") {
      allowed = !lastSpinAt;
    } else if (mode === "once_per_day") {
      allowed = !lastSpinAt || !sameLocalDay(lastSpinAt, new Date());
    }

    if (!allowed && showError) {
      const message = getSetting(
        ["errorFrequencyLimitExceeded", "errorOneTimeOnly", "errorTryAgainLater"],
        "Please try again later when you are eligible.",
      );
      setFormError(message);
    }

    return allowed;
  }

  function markSpinPerformed() {
    writeVisitorState({
      lastSpinAt: new Date().toISOString(),
    });
  }

  function isDisplayAllowed() {
    if (toBoolean(getSetting(["hideOnMobileDevices"], false), false) && isMobileViewport()) {
      return false;
    }
    if (!isDisplayPageAllowed() || !isDisplayDayAllowed()) {
      return false;
    }
    return true;
  }

  function getSegmentSlices(segments) {
    if (!segments.length) return [];

    const totalProbability = segments.reduce((sum, segment) => {
      const value = Number(segment?.probability || 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    let cursor = -90;
    return segments.map((segment) => {
      const value = Number(segment?.probability || 0);
      const ratio = totalProbability > 0 ? value / totalProbability : 1 / segments.length;
      const sweep = ratio * 360;
      const start = cursor;
      const end = cursor + sweep;
      const mid = start + sweep / 2;
      cursor = end;
      return { segment, start, end, mid };
    });
  }

  function splitLabelIntoLines(label) {
    const clean = String(label || "").trim().replace(/\s+/g, " ");
    if (!clean) return [];
    if (clean.length <= 10 || !clean.includes(" ")) return [clean];

    const words = clean.split(" ");
    if (words.length === 2) return words;

    const midIndex = Math.ceil(words.length / 2);
    const first = words.slice(0, midIndex).join(" ");
    const second = words.slice(midIndex).join(" ");
    return [first, second];
  }

  function applyButtonStyles(button) {
    if (!button) return;
    if (wheelSettings.buttonBackgroundColor) {
      button.style.background = wheelSettings.buttonBackgroundColor;
    }
    if (wheelSettings.buttonTextColor) {
      button.style.color = wheelSettings.buttonTextColor;
      button.style.borderColor = wheelSettings.buttonTextColor;
    }
  }

  function applyTextColor(element) {
    if (!element) return;
    if (wheelSettings.textColor) {
      element.style.color = wheelSettings.textColor;
    }
  }

  function setImportantStyle(element, property, value) {
    if (!element) return;
    element.style.setProperty(property, value, "important");
  }

  function enforcePopupSpacing() {
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    const isResultVisible = resultDiv && resultDiv.style.display !== "none";
    if (!isResultVisible) {
      setImportantStyle(titleEl, "display", "block");
    }
    setImportantStyle(titleEl, "margin", "0");
    setImportantStyle(titleEl, "margin-top", isDesktop ? "0" : "14px");
    setImportantStyle(titleEl, "padding", "0");
    setImportantStyle(titleEl, "min-height", "0");
    if (!isResultVisible) {
      setImportantStyle(descriptionEl, "display", "block");
    }
    setImportantStyle(descriptionEl, "margin", "0");
    setImportantStyle(descriptionEl, "margin-top", "6px");
    setImportantStyle(descriptionEl, "padding", "0");
    setImportantStyle(descriptionEl, "min-height", "0");
    setImportantStyle(resultHeadingEl, "display", "block");
    setImportantStyle(resultHeadingEl, "margin", "0");
    setImportantStyle(resultHeadingEl, "margin-top", "2px");
    setImportantStyle(resultHeadingEl, "padding", "0");
    setImportantStyle(resultHeadingEl, "min-height", "0");
    setImportantStyle(resultDescriptionEl, "display", "block");
    setImportantStyle(resultDescriptionEl, "margin", "0");
    setImportantStyle(resultDescriptionEl, "margin-top", "6px");
    setImportantStyle(resultDescriptionEl, "padding", "0");
    setImportantStyle(resultDescriptionEl, "min-height", "0");
    setImportantStyle(resultEmailSentEl, "display", "block");
    setImportantStyle(resultEmailSentEl, "margin", "0");
    setImportantStyle(resultEmailSentEl, "margin-top", "4px");
    setImportantStyle(resultEmailSentEl, "padding", "0");
    setImportantStyle(resultEmailSentEl, "min-height", "0");
    setImportantStyle(resultRewardEl, "display", "block");
    setImportantStyle(resultRewardEl, "margin", "0");
    setImportantStyle(resultRewardEl, "margin-top", "6px");
    setImportantStyle(resultRewardEl, "padding", "0");
    setImportantStyle(resultRewardEl, "min-height", "0");
    setImportantStyle(infoTextEl, "display", "block");
    setImportantStyle(infoTextEl, "margin", "0");
    setImportantStyle(infoTextEl, "margin-top", "10px");
    setImportantStyle(infoTextEl, "padding", "0");
    setImportantStyle(infoTextEl, "min-height", "0");
  }

  function setFormError(message) {
    if (!formErrorEl) return;
    const safeMessage = String(message || "").trim();
    if (!safeMessage) {
      formErrorEl.style.display = "none";
      formErrorEl.textContent = "";
      return;
    }
    formErrorEl.textContent = safeMessage;
    formErrorEl.style.display = "block";
  }

  function clearFormError() {
    setFormError("");
  }

  function applyLogoSettings() {
    if (!topLogoEl || !topLogoImg || !centerLogoEl || !centerLogoImg) return;

    const logoImageUrl = String(getSetting(["logoImageUrl"], "") || "").trim();
    const logoPosition = getSetting(["logoPosition"], "center_of_wheel");

    if (!logoImageUrl) {
      topLogoEl.style.display = "none";
      centerLogoEl.style.display = "none";
      return;
    }

    topLogoImg.src = logoImageUrl;
    centerLogoImg.src = logoImageUrl;

    const showTopLogo = logoPosition === "top_of_popup" || logoPosition === "both";
    const showCenterLogo = logoPosition === "center_of_wheel" || logoPosition === "both";

    topLogoEl.style.display = showTopLogo ? "flex" : "none";
    centerLogoEl.style.display = showCenterLogo ? "block" : "none";
  }

  function applyFormFieldSettings() {
    const popupBehavior = getSetting(["popupBehavior"], "default");
    const spinFirstMode = popupBehavior === "spin_first";
    const disableAll = toBoolean(getSetting(["disableAllFormFields"], false), false);

    const showName = !disableAll && toBoolean(getSetting(["showNameField"], false), false);
    const showEmailByConfig = toBoolean(getSetting(["showEmailField"], true), true);
    const showPhone = !disableAll && toBoolean(getSetting(["showPhoneField"], false), false);
    const showConsent = !disableAll && toBoolean(getSetting(["showConsentCheckbox"], false), false);

    const shouldShowInputs = !spinFirstMode;
    const showEmail = shouldShowInputs && (!disableAll && showEmailByConfig);

    if (nameInput) {
      nameInput.placeholder = getSetting(["initialNamePlaceholder"], "Enter your name");
      nameInput.style.display = showName && shouldShowInputs ? "" : "none";
      nameInput.required =
        showName &&
        shouldShowInputs &&
        getSetting(["nameFieldRequirement"], "required") === "required";
    }

    emailInput.placeholder = getSetting(
      ["initialEmailPlaceholder", "emailPlaceholder"],
      "Enter your email",
    );
    emailInput.style.display = showEmail ? "" : "none";
    emailInput.required =
      showEmail && getSetting(["emailFieldRequirement"], "required") === "required";

    if (phoneInput) {
      phoneInput.placeholder = getSetting(["initialPhonePlaceholder"], "Enter your phone number");
      phoneInput.style.display = showPhone && shouldShowInputs ? "" : "none";
      phoneInput.required =
        showPhone &&
        shouldShowInputs &&
        getSetting(["phoneFieldRequirement"], "required") === "required";
    }

    if (consentRowEl && consentCheckbox) {
      consentRowEl.style.display = showConsent && shouldShowInputs ? "flex" : "none";
      consentCheckbox.required = showConsent && shouldShowInputs;
    }

    if (infoTextEl) {
      infoTextEl.style.display = shouldShowInputs ? "" : "none";
    }
  }

  function applyThemeFromSettings() {
    if (!wheelConfig) return;

    const heading = getSetting(["initialHeading", "title"], wheelConfig.title || "Spin to Win!");
    const description = getSetting(
      ["initialDescription", "description"],
      "Try your luck and win amazing prizes!",
    );
    const ctaText = getSetting(["initialCtaText", "ctaText"], "SPIN NOW");
    const infoText = getSetting(
      ["initialInfoText"],
      "By entering, you agree to receive updates and offers from our store.",
    );

    if (titleEl) {
      titleEl.textContent = heading;
      titleEl.style.color = wheelSettings.headingColor || "";
    }
    if (descriptionEl) {
      descriptionEl.textContent = description;
      applyTextColor(descriptionEl);
    }
    if (infoTextEl) {
      infoTextEl.textContent = infoText;
      applyTextColor(infoTextEl);
    }

    spinBtn.textContent = ctaText;
    applyButtonStyles(spinBtn);

    if (resultHeadingEl) {
      resultHeadingEl.style.color = wheelSettings.headingColor || "";
    }
    applyTextColor(resultDescriptionEl);
    applyTextColor(resultEmailSentEl);
    if (copyBtn) {
      copyBtn.textContent = getSetting(["resultCopyCodeLabel"], "Copy Code");
      applyButtonStyles(copyBtn);
    }
    if (continueBtn) {
      continueBtn.textContent = getSetting(["resultContinueButtonLabel"], "Continue Shopping");
      applyButtonStyles(continueBtn);
    }
    applyTextColor(resultRewardEl);

    if (codeRowEl && wheelSettings.buttonBackgroundColor) {
      codeRowEl.style.borderColor = wheelSettings.buttonBackgroundColor;
    }

    modal.style.backgroundColor = wheelSettings.backgroundColor || "";
    if (wheelSettings.backgroundImageUrl) {
      modal.style.backgroundImage = `url(${wheelSettings.backgroundImageUrl})`;
      modal.style.backgroundSize = "cover";
      modal.style.backgroundPosition = "center";
      modal.style.backgroundRepeat = "no-repeat";
    } else {
      modal.style.backgroundImage = "none";
    }

    enforcePopupSpacing();
    applyFormFieldSettings();
    applyLogoSettings();
    applySideTriggerStyles();
    applyCountdownStyles();
  }

  function drawWheel() {
    const segments = getSegments();
    const slices = getSegmentSlices(segments);
    if (!slices.length) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 8;
    const labelRadius = radius * 0.62;
    const segmentTextColors = wheelSettings.segmentTextColors || {};
    const wheelTextColor = wheelSettings.wheelTextColor || DEFAULT_WHEEL_TEXT_COLOR;

    const segmentCount = slices.length;
    const baseFontSize = segmentCount <= 4 ? 18 : segmentCount <= 6 ? 15 : segmentCount <= 8 ? 13 : 11;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    slices.forEach(({ segment, start, end }) => {
      const startRad = (start * Math.PI) / 180;
      const endRad = (end * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startRad, endRad);
      ctx.closePath();
      ctx.fillStyle = segment.color || "#f6b347";
      ctx.fill();
    });

    slices.forEach(({ start }) => {
      const angle = (start * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = POINTER_BORDER_COLOR;
    ctx.lineWidth = 6;
    ctx.stroke();

    slices.forEach(({ segment, mid }) => {
      const angleRad = (mid * Math.PI) / 180;
      const x = centerX + labelRadius * Math.cos(angleRad);
      const y = centerY + labelRadius * Math.sin(angleRad);

      const topBasedAngle = normalizeDegree(mid + 90);
      const textRotation =
        topBasedAngle > 90 && topBasedAngle < 270 ? topBasedAngle + 180 : topBasedAngle;

      const lines = splitLabelIntoLines(segment.label);
      if (!lines.length) return;

      const maxLabelLen = Math.max(...lines.map((l) => l.length));
      const fontSize = maxLabelLen > 10 ? Math.max(baseFontSize - 2, 10) : baseFontSize;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((textRotation * Math.PI) / 180);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = segmentTextColors[segment.id] || wheelTextColor;
      ctx.font = `700 ${fontSize}px sans-serif`;

      const lineGap = fontSize + 2;
      const startY = lines.length > 1 ? -lineGap / 2 : 0;
      lines.forEach((line, index) => {
        ctx.fillText(line, 0, startY + index * lineGap);
      });
      ctx.restore();
    });

    const centerFill =
      wheelSettings.wheelCenterColor || wheelSettings.primaryColor || DEFAULT_CENTER_COLOR;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 46, 0, Math.PI * 2);
    ctx.fillStyle = centerFill;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    const centerFontSize = Math.max(16, Math.round(canvas.width * 0.045));
    ctx.fillStyle = wheelTextColor;
    ctx.font = `700 ${centerFontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", centerX, centerY);
  }

  function getRotationForResult(segmentId) {
    const slices = getSegmentSlices(getSegments());
    const target = slices.find((slice) => slice.segment.id === segmentId);
    if (!target) return 4 * 360;

    const normalizedMid = normalizeDegree(target.mid);
    return 4 * 360 + (360 - normalizedMid);
  }

  function isNoRewardValue(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return normalized === "" || normalized === "NONE" || normalized === "NO_DISCOUNT";
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function ensureSideTrigger() {
    if (sideTriggerEl) return;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "lucky-wheel-side-trigger";
    trigger.setAttribute("aria-label", "Open lucky wheel popup");

    const close = document.createElement("span");
    close.className = "lucky-wheel-side-trigger-close";
    close.textContent = "×";

    const label = document.createElement("span");
    label.className = "lucky-wheel-side-trigger-label";

    const icon = document.createElement("span");
    icon.className = "lucky-wheel-side-trigger-icon";
    icon.textContent = "↗";

    trigger.append(close, label, icon);
    trigger.addEventListener("click", () => openPopup({ force: true }));

    document.body.appendChild(trigger);

    sideTriggerEl = trigger;
    sideTriggerLabelEl = label;
    sideTriggerIconEl = icon;
  }

  function applySideTriggerStyles() {
    if (!sideTriggerEl) return;

    sideTriggerEl.style.background = wheelSettings.buttonBackgroundColor || "#303030";
    sideTriggerEl.style.color = wheelSettings.buttonTextColor || "#ffffff";
  }

  function updateSideTriggerVisibility() {
    if (!toBoolean(wheelSettings.showSideTriggerButton, false)) {
      if (sideTriggerEl) sideTriggerEl.style.display = "none";
      return;
    }

    ensureSideTrigger();
    if (!sideTriggerEl || !sideTriggerLabelEl || !sideTriggerIconEl) return;

    if (!isDisplayAllowed() || overlay.style.display === "flex") {
      sideTriggerEl.style.display = "none";
      return;
    }

    const position = getSetting(["sideTriggerPosition"], "left") === "right" ? "right" : "left";
    sideTriggerEl.classList.toggle("lucky-wheel-side-trigger--left", position === "left");
    sideTriggerEl.classList.toggle("lucky-wheel-side-trigger--right", position === "right");
    sideTriggerLabelEl.textContent = getSetting(["sideTriggerButtonText"], "💫 Get Discount");
    sideTriggerIconEl.style.display = getSetting(["sideTriggerType"], "text") === "icon_text" ? "" : "none";

    applySideTriggerStyles();
    sideTriggerEl.style.display = "flex";
  }

  function ensureCountdown() {
    if (countdownEl) return;

    const wrap = document.createElement("div");
    wrap.className = "lucky-wheel-countdown lucky-wheel-countdown--bottom";

    const time = document.createElement("span");
    time.className = "lucky-wheel-countdown-time";

    const code = document.createElement("span");
    code.className = "lucky-wheel-countdown-code";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "lucky-wheel-countdown-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close countdown bar");
    close.addEventListener("click", stopCountdown);

    wrap.append(time, code, close);
    document.body.appendChild(wrap);

    countdownEl = wrap;
    countdownTimeEl = time;
    countdownCodeEl = code;
    countdownCloseEl = close;
  }

  function applyCountdownStyles() {
    if (!countdownEl) return;

    countdownEl.style.background = wheelSettings.buttonBackgroundColor || "#303030";
    countdownEl.style.color = wheelSettings.buttonTextColor || "#ffffff";

    if (countdownCloseEl) {
      countdownCloseEl.style.color = wheelSettings.buttonTextColor || "#ffffff";
      countdownCloseEl.style.borderColor = wheelSettings.buttonTextColor || "#ffffff";
    }
  }

  function stopCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (countdownEl) {
      countdownEl.style.display = "none";
    }
  }

  function getCountdownDurationMs() {
    const expiration = getSetting(["discountCodeExpiration"], "never");
    if (expiration === "in_24_hours") return 24 * 60 * 60 * 1000;
    if (expiration === "in_3_days") return 3 * 24 * 60 * 60 * 1000;
    if (expiration === "in_7_days") return 7 * 24 * 60 * 60 * 1000;
    return null;
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function startCountdown(couponCode) {
    if (!toBoolean(getSetting(["showCountdownAfterReveal"], false), false)) {
      stopCountdown();
      return;
    }

    ensureCountdown();
    if (!countdownEl || !countdownTimeEl || !countdownCodeEl) return;

    stopCountdown();
    applyCountdownStyles();

    countdownEl.classList.toggle(
      "lucky-wheel-countdown--top",
      getSetting(["countdownPosition"], "bottom_of_screen") === "top_of_screen",
    );
    countdownEl.classList.toggle(
      "lucky-wheel-countdown--bottom",
      getSetting(["countdownPosition"], "bottom_of_screen") !== "top_of_screen",
    );

    countdownCodeEl.textContent = couponCode || "CODE";

    const countdownLabel = getSetting(["countdownTimerText"], "Expires in");
    const durationMs = getCountdownDurationMs();

    if (durationMs === null) {
      countdownTimeEl.textContent = `${countdownLabel} No expiry`;
      countdownEl.style.display = "flex";
      return;
    }

    const target = Date.now() + durationMs;
    const tick = () => {
      const remaining = target - Date.now();
      if (remaining <= 0) {
        stopCountdown();
        return;
      }
      countdownTimeEl.textContent = `${countdownLabel} ${formatCountdown(remaining)}`;
      countdownEl.style.display = "flex";
    };

    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  function trackImpression() {
    return fetch(`${proxyUrl}/track-impression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wheelId: wheelConfig.id }),
    });
  }

  function setInitialContentVisibility(visible) {
    const display = visible ? "" : "none";
    if (titleEl) titleEl.style.display = display;
    if (descriptionEl) descriptionEl.style.display = display;
  }

  function resetPopupView() {
    setInitialContentVisibility(true);
    if (form) form.style.display = "flex";
    if (resultDiv) resultDiv.style.display = "none";
    clearFormError();
    resetSpinUi();
  }

  function openPopup(options = {}) {
    if (!options.force && !isDisplayAllowed()) return;
    if (overlay.style.display === "flex") return;

    resetPopupView();
    overlay.style.display = "flex";
    updateSideTriggerVisibility();

    if (wheelConfig?.id) {
      trackImpression().catch((error) => {
        console.error("Failed to track impression:", error);
      });
    }
  }

  function closePopup() {
    overlay.style.display = "none";
    updateSideTriggerVisibility();
  }

  function getFormPayload() {
    return {
      name: String(nameInput?.value || "").trim(),
      email: String(emailInput?.value || "").trim(),
      phone: String(phoneInput?.value || "").trim(),
      consentAccepted: Boolean(consentCheckbox?.checked),
    };
  }

  function validateFormBeforeSpin() {
    if (!isSpinAllowed(true)) return false;

    const popupBehavior = getSetting(["popupBehavior"], "default");
    const spinFirstMode = popupBehavior === "spin_first";
    if (spinFirstMode) return true;

    const disableAll = toBoolean(getSetting(["disableAllFormFields"], false), false);
    if (disableAll) return true;

    const showName = toBoolean(getSetting(["showNameField"], false), false);
    const showEmailByConfig = toBoolean(getSetting(["showEmailField"], true), true);
    const showPhone = toBoolean(getSetting(["showPhoneField"], false), false);
    const showConsent = toBoolean(getSetting(["showConsentCheckbox"], false), false);
    const shouldShowInputs = !spinFirstMode;
    const showEmail = shouldShowInputs && (!disableAll && showEmailByConfig);

    const { name, email, phone, consentAccepted } = getFormPayload();

    if (!disableAll && showName && getSetting(["nameFieldRequirement"], "required") === "required" && !name) {
      setFormError("Please enter your name");
      return false;
    }

    if (showEmail) {
      const emailRequired = getSetting(["emailFieldRequirement"], "required") === "required";
      if (emailRequired && !email) {
        setFormError(getSetting(["errorEmailInvalid"], "Please enter a valid email address"));
        return false;
      }
      if (email && !isValidEmail(email)) {
        setFormError(getSetting(["errorEmailInvalid"], "Please enter a valid email address"));
        return false;
      }
    }

    if (
      !disableAll &&
      showPhone &&
      shouldShowInputs &&
      getSetting(["phoneFieldRequirement"], "required") === "required" &&
      !phone
    ) {
      setFormError("Please enter your phone number");
      return false;
    }

    if (!disableAll && showConsent && shouldShowInputs && !consentAccepted) {
      setFormError("Please accept the consent checkbox");
      return false;
    }

    clearFormError();
    return true;
  }

  function resetSpinUi() {
    isSpinning = false;
    spinBtn.disabled = false;
    spinBtn.textContent = getSetting(["initialCtaText", "ctaText"], "SPIN NOW");
  }

  function showResult(result) {
    if (form) form.style.display = "none";
    if (!resultDiv) return;

    setInitialContentVisibility(false);
    resultDiv.style.display = "flex";

    const noLuckByCode = isNoRewardValue(result?.couponCode);
    const noLuckByLabel = /try\s*again|no\s*luck/i.test(String(result?.label || ""));
    const isNoLuck = noLuckByCode || noLuckByLabel;

    if (isNoLuck) {
      if (resultHeadingEl) {
        resultHeadingEl.textContent = getSetting(["noLuckHeading"], "🙈 Not This Time!");
      }
      if (resultDescriptionEl) {
        resultDescriptionEl.textContent = getSetting(
          ["noLuckSubheading"],
          "Try again later — new rewards come often.",
        );
      }
      if (resultEmailSentEl) resultEmailSentEl.style.display = "none";
      if (resultRewardEl) resultRewardEl.style.display = "none";
      if (codeRowEl) codeRowEl.style.display = "none";
      stopCountdown();
    } else {
      if (resultHeadingEl) {
        resultHeadingEl.textContent = getSetting(["resultHeading"], "🎁 You Won!");
      }
      if (resultDescriptionEl) {
        resultDescriptionEl.textContent = getSetting(
          ["resultDescription"],
          "Copy your code and enjoy your reward at checkout.",
        );
      }
      if (resultEmailSentEl) {
        resultEmailSentEl.style.display = "block";
        resultEmailSentEl.textContent = getSetting(
          ["resultEmailSentText"],
          "Check your email for your discount code!",
        );
      }
      if (resultRewardEl) {
        resultRewardEl.style.display = "block";
        resultRewardEl.textContent = `Reward: ${result.label || ""}`;
      }

      if (couponEl) {
        couponEl.textContent = String(result.couponCode || "").trim();
      }
      if (codeRowEl) {
        codeRowEl.style.display = couponEl && couponEl.textContent ? "flex" : "none";
      }

      startCountdown(couponEl ? couponEl.textContent : "");
    }

    if (continueBtn) {
      continueBtn.style.display = "inline-flex";
      continueBtn.textContent = getSetting(["resultContinueButtonLabel"], "Continue Shopping");
    }

    applyThemeFromSettings();
  }

  function setupPopupTriggers() {
    if (!isDisplayAllowed()) {
      updateSideTriggerVisibility();
      return;
    }

    updateSideTriggerVisibility();

    const triggerCondition = getSetting(["triggerCondition"], "show_immediately");

    if (triggerCondition === "show_immediately") {
      setTimeout(() => openPopup(), 150);
      return;
    }

    if (triggerCondition === "after_delay") {
      setTimeout(() => openPopup(), 3000);
      return;
    }

    if (triggerCondition === "after_scroll") {
      const onScroll = () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (maxScroll <= 0) return;
        const ratio = window.scrollY / maxScroll;
        if (ratio >= 0.35) {
          window.removeEventListener("scroll", onScroll);
          openPopup();
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return;
    }

    if (triggerCondition === "on_exit_intent") {
      const onMouseOut = (event) => {
        if (event.relatedTarget) return;
        if (typeof event.clientY === "number" && event.clientY <= 0) {
          document.removeEventListener("mouseout", onMouseOut);
          openPopup();
        }
      };
      document.addEventListener("mouseout", onMouseOut);
      return;
    }

    setTimeout(() => openPopup(), 3000);
  }

  async function initWheel() {
    try {
      const activeWheelUrl = `${proxyUrl}/active-wheel?ts=${Date.now()}`;
      const response = await fetch(activeWheelUrl, { cache: "no-store" });
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok || !contentType.includes("application/json")) {
        const body = await response.text();
        throw new Error(`Proxy request failed (${response.status}): ${body.slice(0, 180)}`);
      }

      const data = await response.json();
      if (!data || !data.wheel) return;

      wheelConfig = data.wheel;
      wheelSettings = parseWheelSettings(wheelConfig.config);

      resetPopupView();
      applyThemeFromSettings();
      drawWheel();
      setupPopupTriggers();

      window.addEventListener("resize", () => {
        if (toBoolean(getSetting(["hideOnMobileDevices"], false), false) && isMobileViewport()) {
          closePopup();
        }
        enforcePopupSpacing();
        updateSideTriggerVisibility();
      });
    } catch (error) {
      console.error("Failed to load lucky wheel:", error);
    }
  }

  async function handleSpin() {
    if (isSpinning || !wheelConfig) return;
    if (!validateFormBeforeSpin()) return;

    const payload = getFormPayload();
    clearFormError();

    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = "SPINNING...";

    try {
      const response = await fetch(`${proxyUrl}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wheelId: wheelConfig.id,
          email: payload.email,
          name: payload.name,
          phone: payload.phone,
          consentAccepted: payload.consentAccepted,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/json")) {
        const body = await response.text();
        throw new Error(`Spin failed (${response.status}): ${body.slice(0, 180)}`);
      }

      const result = await response.json();
      if (result.error) {
        setFormError(result.error);
        resetSpinUi();
        return;
      }

      const rotation = getRotationForResult(result.segmentId);
      currentRotation += rotation;
      canvas.style.transform = `rotate(${currentRotation}deg)`;

      setTimeout(() => {
        showResult(result);
        isSpinning = false;
        markSpinPerformed();
        updateSideTriggerVisibility();
      }, 5000);
    } catch (error) {
      console.error("Spin failed:", error);
      setFormError(getSetting(["errorTryAgainLater"], "Please try again later when you are eligible."));
      resetSpinUi();
    }
  }

  async function handleCopyCoupon() {
    const coupon = couponEl ? String(couponEl.textContent || "").trim() : "";
    if (!coupon || !copyBtn) return;

    const copyLabel = getSetting(["resultCopyCodeLabel"], "Copy Code");
    try {
      await navigator.clipboard.writeText(coupon);
      copyBtn.textContent = "Copied";
      setTimeout(() => {
        copyBtn.textContent = copyLabel;
      }, 1400);
    } catch (error) {
      console.error("Failed to copy coupon:", error);
      copyBtn.textContent = copyLabel;
    }
  }

  closeBtn.onclick = closePopup;
  spinBtn.onclick = handleSpin;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closePopup();
    }
  });

  if (copyBtn) copyBtn.addEventListener("click", handleCopyCoupon);
  if (continueBtn) {
    continueBtn.addEventListener("click", closePopup);
  }

  initWheel();
})();
