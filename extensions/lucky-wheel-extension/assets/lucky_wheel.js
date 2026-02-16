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
  const emailInput = document.getElementById("lucky-wheel-email");
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
  const canvas = document.getElementById("wheel-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;

  if (!overlay || !modal || !spinBtn || !emailInput || !canvas || !ctx) return;

  let wheelConfig = null;
  let wheelSettings = {};
  let isSpinning = false;
  let currentRotation = 0;

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

  function getSegments() {
    return Array.isArray(wheelConfig?.segments) ? wheelConfig.segments : [];
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

  function applyThemeFromSettings() {
    if (!wheelConfig) return;

    const heading = getSetting(
      ["initialHeading", "title"],
      wheelConfig.title || "Spin to Win!",
    );
    const description = getSetting(
      ["initialDescription", "description"],
      "Try your luck and win amazing prizes!",
    );
    const emailPlaceholder = getSetting(
      ["initialEmailPlaceholder", "emailPlaceholder"],
      "Enter your email",
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

    emailInput.placeholder = emailPlaceholder;
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
      continueBtn.textContent = getSetting(
        ["resultContinueButtonLabel"],
        "Continue Shopping",
      );
      applyButtonStyles(continueBtn);
    }
    applyTextColor(resultRewardEl);

    if (codeRowEl && wheelSettings.buttonBackgroundColor) {
      codeRowEl.style.borderColor = wheelSettings.buttonBackgroundColor;
    }

    if (wheelSettings.backgroundColor) {
      modal.style.background = wheelSettings.backgroundColor;
    }
  }

  function drawWheel() {
    const segments = getSegments();
    const slices = getSegmentSlices(segments);
    if (!slices.length) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 8;
    const labelRadius = radius * 0.67;
    const segmentTextColors = wheelSettings.segmentTextColors || {};
    const wheelTextColor = wheelSettings.wheelTextColor || DEFAULT_WHEEL_TEXT_COLOR;

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
      ctx.lineTo(
        centerX + radius * Math.cos(angle),
        centerY + radius * Math.sin(angle),
      );
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
        topBasedAngle > 90 && topBasedAngle < 270
          ? topBasedAngle + 180
          : topBasedAngle;

      const lines = splitLabelIntoLines(segment.label);
      if (!lines.length) return;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((textRotation * Math.PI) / 180);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = segmentTextColors[segment.id] || wheelTextColor;
      ctx.font = "700 18px sans-serif";

      const lineGap = 18;
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

    ctx.fillStyle = wheelSettings.wheelTextColor || "#1f1f1f";
    ctx.font = "700 38px sans-serif";
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

  function resetSpinUi() {
    isSpinning = false;
    spinBtn.disabled = false;
    spinBtn.textContent = getSetting(["initialCtaText", "ctaText"], "SPIN NOW");
  }

  function showResult(result) {
    if (form) form.style.display = "none";
    if (!resultDiv) return;

    resultDiv.style.display = "block";

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
    }

    if (continueBtn) {
      continueBtn.style.display = "inline-flex";
      continueBtn.textContent = getSetting(
        ["resultContinueButtonLabel"],
        "Continue Shopping",
      );
    }

    applyThemeFromSettings();
  }

  async function initWheel() {
    try {
      const response = await fetch(`${proxyUrl}/active-wheel`);
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok || !contentType.includes("application/json")) {
        const body = await response.text();
        throw new Error(`Proxy request failed (${response.status}): ${body.slice(0, 180)}`);
      }

      const data = await response.json();
      if (!data || !data.wheel) return;

      wheelConfig = data.wheel;
      wheelSettings = parseWheelSettings(wheelConfig.config);

      if (form) form.style.display = "flex";
      if (resultDiv) resultDiv.style.display = "none";

      applyThemeFromSettings();
      drawWheel();

      setTimeout(async () => {
        overlay.style.display = "flex";
        try {
          await fetch(`${proxyUrl}/track-impression`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wheelId: wheelConfig.id }),
          });
        } catch (error) {
          console.error("Failed to track impression:", error);
        }
      }, 3000);
    } catch (error) {
      console.error("Failed to load lucky wheel:", error);
    }
  }

  async function handleSpin() {
    if (isSpinning || !wheelConfig) return;

    const email = String(emailInput.value || "").trim();
    if (!email) {
      alert("Please enter your email!");
      return;
    }

    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = "SPINNING...";

    try {
      const response = await fetch(`${proxyUrl}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wheelId: wheelConfig.id, email }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/json")) {
        const body = await response.text();
        throw new Error(`Spin failed (${response.status}): ${body.slice(0, 180)}`);
      }

      const result = await response.json();
      if (result.error) {
        alert(result.error);
        resetSpinUi();
        return;
      }

      const rotation = getRotationForResult(result.segmentId);
      currentRotation += rotation;
      canvas.style.transform = `rotate(${currentRotation}deg)`;

      setTimeout(() => {
        showResult(result);
        isSpinning = false;
      }, 5000);
    } catch (error) {
      console.error("Spin failed:", error);
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

  closeBtn.onclick = function () {
    overlay.style.display = "none";
  };

  spinBtn.onclick = handleSpin;
  if (copyBtn) copyBtn.addEventListener("click", handleCopyCoupon);
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      overlay.style.display = "none";
    });
  }

  initWheel();
})();
