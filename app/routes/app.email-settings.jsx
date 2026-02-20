import { json } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  Button,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return json({});
};

export default function EmailSettingsPage() {
  const navigate = useNavigate();

  return (
    <Page
      title="Email Settings"
      subtitle="Manage email settings for your discount notifications"
    >
      <BlockStack gap="500">
        <Banner title="Upgrade to unlock email integration" tone="warning">
          <BlockStack gap="300">
            <Text as="p">
              To send the discount codes to your customers via email, please
              upgrade to a paid plan.
            </Text>
            <div>
              <Button onClick={() => navigate("/app/plans")}>View Plans</Button>
            </div>
          </BlockStack>
        </Banner>

        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd" tone="subdued">
                Email Notifications
              </Text>
              <Text as="p" tone="subdued">
                Send discount codes to customers via email
              </Text>
            </BlockStack>
            <div
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: "#b5b5b5",
                position: "relative",
                cursor: "not-allowed",
                opacity: 0.6,
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#ffffff",
                  position: "absolute",
                  top: "2px",
                  left: "2px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </InlineStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
