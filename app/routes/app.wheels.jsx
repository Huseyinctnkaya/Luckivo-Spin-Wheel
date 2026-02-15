import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    IndexTable,
    Badge,
    Button,
    Text,
    EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const wheels = await db.wheel.findMany({
        where: { shop: session.shop },
        orderBy: { createdAt: "desc" },
    });

    return json({ wheels });
};

export default function WheelsPage() {
    const { wheels } = useLoaderData();

    const resourceName = {
        singular: "wheel",
        plural: "wheels",
    };

    const rowMarkup = wheels.map(
        ({ id, title, isActive, createdAt }, index) => (
            <IndexTable.Row id={id} key={id} position={index}>
                <IndexTable.Cell>
                    <Text variant="bodyMd" fontWeight="bold" as="span">
                        {title}
                    </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                    {isActive ? (
                        <Badge tone="success">Active</Badge>
                    ) : (
                        <Badge tone="attention">Draft</Badge>
                    )}
                </IndexTable.Cell>
                <IndexTable.Cell>
                    {new Date(createdAt).toLocaleDateString()}
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <Button url={`/app/wheels/${id}`} variant="plain">
                        Edit
                    </Button>
                </IndexTable.Cell>
            </IndexTable.Row>
        )
    );

    return (
        <Page
            title="Lucky Wheels"
            primaryAction={
                <Button variant="primary" url="/app/wheels/new">
                    Create Wheel
                </Button>
            }
        >
            <Layout>
                <Layout.Section>
                    {wheels.length === 0 ? (
                        <Card>
                            <EmptyState
                                heading="Create a lucky wheel to boost sales"
                                action={{
                                    content: "Create Wheel",
                                    url: "/app/wheels/new",
                                }}
                                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                            >
                                <p>
                                    Customize your wheel, set up prizes, and watch your conversion
                                    rates grow.
                                </p>
                            </EmptyState>
                        </Card>
                    ) : (
                        <Card padding="0">
                            <IndexTable
                                resourceName={resourceName}
                                itemCount={wheels.length}
                                headings={[
                                    { title: "Title" },
                                    { title: "Status" },
                                    { title: "Created At" },
                                    { title: "Actions" },
                                ]}
                                selectable={false}
                            >
                                {rowMarkup}
                            </IndexTable>
                        </Card>
                    )}
                </Layout.Section>
            </Layout>
        </Page>
    );
}
