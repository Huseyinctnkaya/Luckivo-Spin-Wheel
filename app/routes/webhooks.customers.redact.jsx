import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const customerId = payload?.customer?.id?.toString();
  const customerEmail = payload?.customer?.email;

  if (customerEmail) {
    await db.spin.deleteMany({ where: { customerEmail } });
  }

  return new Response();
};
