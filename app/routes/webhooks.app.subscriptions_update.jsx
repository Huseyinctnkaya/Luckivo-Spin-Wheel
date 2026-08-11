import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Shopify ACTIVE dışında CANCELLED, DECLINED, EXPIRED, FROZEN ve PENDING
  // de gönderiyor. Yalnızca ACTIVE ödeme sayılır — FROZEN, ödemesi alınamamış
  // (kartı geçmeyen) aboneliktir, erişim vermemeli.
  const isPaid = payload?.app_subscription?.status === "ACTIVE";

  // Bu webhook, merchant admin'e hiç girmeden aboneliğini iptal ettiğinde
  // çarkın vitrinde yayında kalmasını engelliyor.
  await db.shop.upsert({
    where: { shop },
    create: { shop, isPaid },
    update: { isPaid },
  });

  return new Response();
};
