import { requireOrgContext } from "@/server/auth/session";
import { listDueDiligenceFields } from "@/server/services/organisations";
import { PageHeader } from "@/components/ui/page-header";
import { PartnerForm } from "../form";

export const metadata = { title: "New partner" };

export default async function NewPartnerPage() {
  const ctx = await requireOrgContext("partner.write");
  const fields = await listDueDiligenceFields(ctx);
  return (
    <div>
      <PageHeader title="New partner" breadcrumbs={[{ label: "NGO & Partners", href: "/admin/partners" }, { label: "New" }]} />
      <PartnerForm fields={fields} canSeeConfidential={ctx.permissions.has("partner.confidential")} />
    </div>
  );
}
