import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getPartner } from "@/server/services/partners";
import { listDueDiligenceFields } from "@/server/services/organisations";
import { PageHeader } from "@/components/ui/page-header";
import { PartnerForm } from "../../form";

export const metadata = { title: "Edit partner" };

export default async function EditPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("partner.write");
  const { id } = await params;
  const [partner, fields] = await Promise.all([load(getPartner(ctx, id)), listDueDiligenceFields(ctx)]);
  return (
    <div>
      <PageHeader title={`Edit ${partner.name}`} breadcrumbs={[{ label: "NGO & Partners", href: "/admin/partners" }, { label: partner.name, href: `/admin/partners/${id}` }, { label: "Edit" }]} />
      <PartnerForm partner={partner} fields={fields} canSeeConfidential={partner.canSeeConfidential} />
    </div>
  );
}
