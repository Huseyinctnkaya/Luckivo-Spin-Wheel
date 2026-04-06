import { json } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
  DropZone,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLanguage } from "../i18n/LanguageContext";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const [wheels, customCode] = await Promise.all([
    db.wheel.findMany({
      where: { shop: session.shop },
      include: { segments: true },
    }),
    db.customCode.findUnique({ where: { shop: session.shop } }),
  ]);

  return json({ wheels, customCode: customCode?.code || "" });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "export") {
    const [wheels, customCode] = await Promise.all([
      db.wheel.findMany({
        where: { shop: session.shop },
        include: { segments: true },
      }),
      db.customCode.findUnique({ where: { shop: session.shop } }),
    ]);

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      shop: session.shop,
      wheels: wheels.map((w) => ({
        id: w.id,
        title: w.title,
        isActive: w.isActive,
        config: w.config,
        segments: w.segments.map((s) => ({
          id: s.id,
          label: s.label,
          value: s.value,
          probability: s.probability,
          color: s.color,
        })),
      })),
      customCode: customCode?.code || "",
    };

    return json({ exportData });
  }

  if (intent === "import") {
    const raw = formData.get("data");

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON file." }, { status: 400 });
    }

    if (!data.wheels || !Array.isArray(data.wheels)) {
      return json({ error: "Invalid file format. Missing wheels data." }, { status: 400 });
    }

    for (const wheel of data.wheels) {
      const existing = await db.wheel.findUnique({ where: { id: wheel.id } });

      if (existing) {
        await db.segment.deleteMany({ where: { wheelId: wheel.id } });
        await db.wheel.update({
          where: { id: wheel.id },
          data: {
            title: wheel.title,
            isActive: wheel.isActive,
            config: wheel.config || "{}",
            segments: {
              create: (wheel.segments || []).map((s) => ({
                label: s.label,
                value: s.value,
                probability: s.probability,
                color: s.color || null,
              })),
            },
          },
        });
      } else {
        await db.wheel.create({
          data: {
            id: wheel.id,
            shop: session.shop,
            title: wheel.title,
            isActive: wheel.isActive,
            config: wheel.config || "{}",
            segments: {
              create: (wheel.segments || []).map((s) => ({
                label: s.label,
                value: s.value,
                probability: s.probability,
                color: s.color || null,
              })),
            },
          },
        });
      }
    }

    if (typeof data.customCode === "string") {
      await db.customCode.upsert({
        where: { shop: session.shop },
        update: { code: data.customCode },
        create: { shop: session.shop, code: data.customCode },
      });
    }

    return json({ success: true, imported: data.wheels.length });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function ImportExportPage() {
  const fetcher = useFetcher();
  const [file, setFile] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const lastExportRef = useRef(null);
  const { t } = useLanguage();

  const isExporting = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "export";
  const isImporting = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "import";

  // Handle export response — trigger download
  useEffect(() => {
    const exportData = fetcher.data?.exportData;
    if (exportData && exportData !== lastExportRef.current) {
      lastExportRef.current = exportData;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wheel-app-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [fetcher.data]);

  // Handle import response
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.imported != null) {
      setImportStatus("done");
      setFile(null);
    }
  }, [fetcher.data]);

  const handleExport = () => {
    const formData = new FormData();
    formData.set("intent", "export");
    fetcher.submit(formData, { method: "post" });
  };

  const handleDrop = useCallback((_droppedFiles, acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setImportStatus(null);
    }
  }, []);

  const handleImport = () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const formData = new FormData();
      formData.set("intent", "import");
      formData.set("data", e.target.result);
      fetcher.submit(formData, { method: "post" });
    };
    reader.readAsText(file);
  };

  return (
    <Page title={t("import_export_title")} backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        {/* Export */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" fontWeight="bold">
              {t("export_title")}
            </Text>
            <Text tone="subdued">
              {t("export_desc")}
            </Text>
            <div>
              <Button variant="primary" onClick={handleExport} loading={isExporting}>
                {t("export_btn")}
              </Button>
            </div>
          </BlockStack>
        </Card>

        {/* Import */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" fontWeight="bold">
              {t("import_title")}
            </Text>
            <Text tone="subdued">
              {t("import_desc")}
            </Text>
            <Banner tone="warning">
              <p>{t("import_warning")}</p>
            </Banner>

            <DropZone
              accept=".json"
              type="file"
              allowMultiple={false}
              onDrop={handleDrop}
            >
              {file ? (
                <DropZone.FileUpload actionHint={file.name} />
              ) : (
                <DropZone.FileUpload actionHint={t("import_drop_hint")} />
              )}
            </DropZone>

            {file && (
              <div>
                <Button variant="primary" onClick={handleImport} loading={isImporting}>
                  {t("import_btn")}
                </Button>
              </div>
            )}

            {importStatus === "done" && (
              <Banner tone="success">
                <p>{t("import_success", fetcher.data?.imported)}</p>
              </Banner>
            )}

            {fetcher.data?.error && (
              <Banner tone="critical">
                <p>{fetcher.data.error}</p>
              </Banner>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
