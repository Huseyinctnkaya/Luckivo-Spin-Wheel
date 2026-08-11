import db from "./db.server";

export const TRIAL_DAYS = 7;

/** Kalan deneme günü sayısı; süre dolduysa 0. */
export function getTrialDaysRemaining(installedAt) {
  const daysSinceInstall =
    (Date.now() - installedAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRIAL_DAYS - daysSinceInstall));
}

/**
 * Mağaza çarkı vitrinde yayınlayabilir mi?
 *
 * Yalnızca yerel veritabanını okur. Storefront proxy'si bunu her sayfa
 * görüntülemesinde çağırdığı için Shopify'a ağ isteği yapılmaz; `isPaid`
 * alanı admin yüklemesinde ve app_subscriptions/update webhook'unda
 * tazelenir.
 *
 * @param {string} shop - "ornek.myshopify.com"
 * @returns {Promise<boolean>}
 */
export async function isShopEntitled(shop) {
  const record = await db.shop.findUnique({ where: { shop } });

  // Kaydı olmayan mağazayı kilitleme. Kayıt admin ilk açıldığında oluşuyor,
  // dolayısıyla burada false dönmek henüz kaydı yazılmamış bir mağazanın
  // vitrinini sessizce kapatmak olurdu. Şüphede kalınca açık bırakmak,
  // yanlışlıkla çalışan bir çarktan daha az zararlı.
  if (!record) return true;

  if (record.isPaid) return true;

  return getTrialDaysRemaining(record.installedAt) > 0;
}
