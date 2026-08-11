import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Kaldırma aboneliği de sonlandırır. isPaid sıfırlanmazsa yeniden kuran
  // mağaza eski "ödenmiş" bayrağını devralıp çarkı bedava çalıştırırdı.
  // installedAt'e bilerek dokunmuyoruz: her yeniden kurulumda taze deneme
  // vermek, kaldır-kur döngüsüyle sonsuz ücretsiz kullanım demek olurdu.
  await db.shop.updateMany({ where: { shop }, data: { isPaid: false } });

  return new Response();
};
