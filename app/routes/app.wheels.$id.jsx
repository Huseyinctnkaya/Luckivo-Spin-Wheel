import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    TextField,
    Button,
    BlockStack,
    InlineGrid,
    Text,
    Badge,
    Banner,
    Box,
    InlineStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ params, request }) => {
    await authenticate.admin(request);
    const wheel = await db.wheel.findUnique({
        where: { id: params.id },
        include: { segments: true },
    });

    if (!wheel) throw new Response("Not Found", { status: 404 });

    return json({ wheel });
};

export const action = async ({ request, params }) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "delete") {
        await db.wheel.delete({ where: { id: params.id } });
        return redirect("/app/wheels");
    }

    const title = formData.get("title");
    const config = formData.get("config");
    const isActive = formData.get("isActive") === "true";
    const segmentsData = JSON.parse(formData.get("segments"));

    await db.wheel.update({
        where: { id: params.id },
        data: {
            title,
            config,
            isActive,
            segments: {
                deleteMany: {},
                create: segmentsData.map(s => ({
                    label: s.label,
                    value: s.value,
                    probability: parseFloat(s.probability || 0),
                    color: s.color,
                })),
            },
        },
    });

    return json({ success: true });
};

export default function WheelEditor() {
    const { wheel } = useLoaderData();
    const [title, setTitle] = useState(wheel.title);
    const [isActive, setIsActive] = useState(wheel.isActive);
    const [segments, setSegments] = useState(wheel.segments);
    const [config, setConfig] = useState(JSON.parse(wheel.config || "{}"));

    const submit = useSubmit();
    const navigation = useNavigation();
    const isSaving = navigation.state === "submitting" && navigation.formData?.get("intent") !== "delete";

    const handleAddSegment = () => {
        setSegments([
            ...segments,
            { label: "New Prize", value: "COUPON", probability: 10, color: "000000" },
        ]);
    };

    const handleRemoveSegment = (index) => {
        setSegments(segments.filter((_, i) => i !== index));
    };

    const handleSegmentChange = (index, field, value) => {
        const newSegments = [...segments];
        newSegments[index][field] = value;
        setSegments(newSegments);
    };

    const handleSave = () => {
        submit(
            {
                title,
                isActive: String(isActive),
                config: JSON.stringify(config),
                segments: JSON.stringify(segments),
            },
            { method: "post" }
        );
    };

    const totalProbability = segments.reduce((acc, s) => acc + parseFloat(s.probability || 0), 0);

    return (
        <Page
            backAction={{ content: "Wheels", url: "/app/wheels" }}
            title={title}
            titleMetadata={
                isActive ? (
                    <Badge tone="success">Active</Badge>
                ) : (
                    <Badge tone="attention">Draft</Badge>
                )
            }
            primaryAction={
                <Button variant="primary" onClick={handleSave} loading={isSaving}>
                    Save
                </Button>
            }
            secondaryActions={[
                {
                    content: "Delete",
                    destructive: true,
                    onAction: () => submit({ intent: "delete" }, { method: "post" }),
                },
            ]}
        >
            <Layout>
                {totalProbability !== 100 && (
                    <Layout.Section>
                        <Banner tone="warning">
                            Total probability is {totalProbability}%. It should ideally be 100% for fair spins.
                        </Banner>
                    </Layout.Section>
                )}
                <Layout.Section>
                    <BlockStack gap="500">
                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">General Settings</Text>
                                <TextField
                                    label="Title"
                                    value={title}
                                    onChange={setTitle}
                                    autoComplete="off"
                                />
                                <Button
                                    onClick={() => setIsActive(!isActive)}
                                    tone={isActive ? "critical" : "success"}
                                >
                                    {isActive ? "Deactivate Wheel" : "Activate Wheel"}
                                </Button>
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="400">
                                <InlineStack align="space-between">
                                    <Text variant="headingMd" as="h2">Wheel Segments</Text>
                                    <Button onClick={handleAddSegment}>Add Segment</Button>
                                </InlineStack>
                                {segments.map((segment, index) => (
                                    <Box key={index} padding="400" borderBlockEndWidth="025" borderColor="border">
                                        <InlineGrid columns={['2fr', '2fr', '1fr', '1fr', 'auto']} gap="400">
                                            <TextField
                                                label="Label"
                                                value={segment.label}
                                                onChange={(val) => handleSegmentChange(index, "label", val)}
                                                autoComplete="off"
                                            />
                                            <TextField
                                                label="Prize/Coupon"
                                                value={segment.value}
                                                onChange={(val) => handleSegmentChange(index, "value", val)}
                                                autoComplete="off"
                                            />
                                            <TextField
                                                label="Prob (%)"
                                                type="number"
                                                value={String(segment.probability)}
                                                onChange={(val) => handleSegmentChange(index, "probability", val)}
                                                autoComplete="off"
                                            />
                                            <TextField
                                                label="Color"
                                                value={segment.color}
                                                onChange={(val) => handleSegmentChange(index, "color", val)}
                                                autoComplete="off"
                                                prefix="#"
                                            />
                                            <div style={{ alignSelf: 'end', paddingBottom: '8px' }}>
                                                <Button
                                                    tone="critical"
                                                    onClick={() => handleRemoveSegment(index)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </InlineGrid>
                                    </Box>
                                ))}
                            </BlockStack>
                        </Card>
                    </BlockStack>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                    <Card>
                        <BlockStack gap="400">
                            <Text variant="headingMd" as="h2">Style Guide</Text>
                            <Text variant="bodyMd" as="p">
                                Use contrasting colors for adjacent segments to make the wheel look professional.
                            </Text>
                            <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                                <Text variant="bodySm" as="p">
                                    Total Prob: {totalProbability}%
                                </Text>
                            </Box>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
