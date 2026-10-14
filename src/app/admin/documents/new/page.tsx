import { requireOrgContext } from "@/server/auth/session";
import { projectOptions } from "@/server/services/projects";
import { partnerOptions } from "@/server/services/partners";
import { ACCEPT_ATTRIBUTE } from "@/server/services/media";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { DocumentFields } from "../fields";
import { createDocumentAction } from "../actions";

export const metadata = { title: "Upload document" };

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ projectId?: string; partnerId?: string; category?: string }> }) {
  const ctx = await requireOrgContext("document.write");
  const [projects, partners] = await Promise.all([projectOptions(ctx), partnerOptions(ctx)]);
  const sp = await searchParams;
  const maxMb = Math.min(Number(process.env.UPLOAD_MAX_MB ?? 15) || 15, 25);
  return (
    <div>
      <PageHeader title="Upload document" breadcrumbs={[{ label: "Documents", href: "/admin/documents" }, { label: "Upload" }]} />
      <Card>
        <CardBody>
          <ActionForm action={createDocumentAction} className="space-y-4">
            <TextField label="File" name="file" type="file" accept={ACCEPT_ATTRIBUTE} required hint={`PDF, images, Word/Excel/PowerPoint, OpenDocument, CSV or text. Maximum ${maxMb} MB. Files are stored privately.`} />
            <DocumentFields projects={projects.map((p) => ({ value: p.id, label: p.title }))} partners={partners.map((p) => ({ value: p.id, label: p.name }))} canConfidential={ctx.permissions.has("document.confidential")} defaults={sp} />
            <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
