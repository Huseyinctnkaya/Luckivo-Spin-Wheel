function buildDiscountEmailHtml({
  couponCode,
  reward,
  shopName,
  subject,
  headerTitle = "You Won!",
  headerSubtitle = "Congratulations on your lucky spin",
  headerEmoji = "🎡",
  brandColor = "#6c5ce7",
  ctaText = "",
  ctaUrl = "",
}) {
  const safeCode = String(couponCode || "").trim();
  const safeReward = String(reward || "").trim();
  const safeName = String(shopName || "Our Store").trim();
  const safeHeaderTitle = String(headerTitle || "You Won!").trim();
  const safeHeaderSubtitle = String(headerSubtitle || "Congratulations on your lucky spin").trim();
  const safeHeaderEmoji = String(headerEmoji || "🎡").trim();
  const safeBrandColor = String(brandColor || "#6c5ce7").trim();
  const safeCtaText = String(ctaText || "").trim();
  const safeCtaUrl = String(ctaUrl || "").trim();

  const ctaBlock = safeCtaText && safeCtaUrl
    ? `<tr>
        <td style="padding:0 40px 28px;text-align:center;">
          <a href="${safeCtaUrl}" style="display:inline-block;background:${safeBrandColor};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;padding:14px 32px;">
            ${safeCtaText}
          </a>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${safeBrandColor} 0%,${safeBrandColor}99 100%);padding:40px 40px 32px;text-align:center;">
              <div style="font-size:48px;margin-bottom:12px;">${safeHeaderEmoji}</div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">${safeHeaderTitle}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">${safeHeaderSubtitle}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 8px;color:#636e72;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Your reward</p>
              <p style="margin:0 0 28px;color:#2d3436;font-size:20px;font-weight:700;">${safeReward}</p>

              <p style="margin:0 0 12px;color:#636e72;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Your discount code</p>
              <div style="background:#f8f7ff;border:2px dashed ${safeBrandColor};border-radius:12px;padding:20px;text-align:center;margin-bottom:28px;">
                <span style="font-size:28px;font-weight:800;color:#2d3436;letter-spacing:3px;">${safeCode}</span>
              </div>

              <p style="margin:0;color:#636e72;font-size:14px;line-height:1.6;">
                Copy the code above and use it at checkout to claim your discount.
                This code is unique to you, so keep it safe!
              </p>
            </td>
          </tr>

          ${ctaBlock}

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <p style="margin:0;color:#b2bec3;font-size:13px;">This email was sent by <strong>${safeName}</strong> via Luckivo Spin Wheel.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendDiscountEmail({
  to,
  couponCode,
  reward,
  shopName,
  fromEmail,
  fromName,
  subject,
  headerTitle,
  headerSubtitle,
  headerEmoji,
  brandColor,
  ctaText,
  ctaUrl,
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Skipping email send.");
    return null;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const safeFrom = fromEmail && fromName
    ? `${fromName} <${fromEmail}>`
    : fromEmail || "Luckivo <onboarding@resend.dev>";

  const safeSubject = subject || "🎁 Your discount code is here!";

  const { data, error } = await resend.emails.send({
    from: safeFrom,
    to: [to],
    subject: safeSubject,
    html: buildDiscountEmailHtml({
      couponCode,
      reward,
      shopName,
      subject: safeSubject,
      headerTitle,
      headerSubtitle,
      headerEmoji,
      brandColor,
      ctaText,
      ctaUrl,
    }),
  });

  if (error) {
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }

  return data;
}
