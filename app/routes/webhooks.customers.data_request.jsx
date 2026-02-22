import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // We do not store personal customer data beyond email for spin results.
  // No additional data to provide.

  return new Response();
};
