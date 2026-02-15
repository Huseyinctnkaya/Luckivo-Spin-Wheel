import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import { useSubmit, useNavigation } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    TextField,
    Button,
    FormLayout,
    BlockStack,
    Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return null;
};

export const action = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();

    const title = formData.get("title");
    const config = formData.get("config");

    const wheel = await db.wheel.create({
        data: {
            shop: session.shop,
            title,
            config,
            isActive: false,
            segments: {
                create: [
                    { label: "10% OFF", value: "SAVE10", probability: 25, color: "#FF5733" },
                    { label: "Better Luck Next Time", value: "TRYAGAIN", probability: 50, color: "#C0C0C0" },
                    { label: "20% OFF", value: "SAVE20", probability: 25, color: "#33FF57" },
                ],
            },
        },
    });

    return redirect(`/app/wheels/${wheel.id}`);
};

export default function NewWheel() {
    const [title, setTitle] = useState("My Lucky Wheel");
    const [primaryColor, setPrimaryColor] = useState("#4f46e5");

    const submit = useSubmit();
    const navigation = useNavigation();
    const isLoading = navigation.state === "submitting";

    const handleSave = () => {
        const config = JSON.stringify({
            primaryColor: primaryColor,
        });

        submit({ title, config }, { method: "post" });
    };

    return (
        <Page
            backAction={{ content: "Wheels", url: "/app/wheels" }}
            title="Create Lucky Wheel"
            primaryAction={
                <Button
                    variant="primary"
                    onClick={handleSave}
                    loading={isLoading}
                >
                    Save and Edit Segments
                </Button>
            }
        >
            <Layout>
                <Layout.Section>
                    <BlockStack gap="500">
                        <Card>
                            <FormLayout>
                                <TextField
                                    label="Wheel Title"
                                    value={title}
                                    onChange={setTitle}
                                    autoComplete="off"
                                    helpText="Give your wheel a name (internal use only)"
                                />
                                <TextField
                                    label="Primary Theme Color"
                                    value={primaryColor}
                                    onChange={setPrimaryColor}
                                    autoComplete="off"
                                    prefix="#"
                                    helpText="Choose a primary color for your wheel (Hex code)"
                                />
                            </FormLayout>
                        </Card>
                    </BlockStack>
                </Layout.Section>
                <Layout.Section variant="oneThird">
                    <Card>
                        <BlockStack gap="200">
                            <Text variant="headingMd" as="h2">Overview</Text>
                            <Text variant="bodyMd" as="p">
                                After saving, you will be able to configure:
                            </Text>
                            <ul>
                                <li>Wheel segments and prizes</li>
                                <li>Win probabilities</li>
                                <li>Display triggers (popup timing, exit intent)</li>
                            </ul>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
