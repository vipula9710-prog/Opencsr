import { requireOrgContext } from "@/server/auth/session";
import { listFocusAreas } from "@/server/services/organisations";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ProgrammeForm } from "../form";

export const metadata = { title: "New programme" };

export default async function NewProgrammePage() {
  const ctx = await requireOrgContext("programme.write");
  const focusAreas = await listFocusAreas(ctx);
  return (
    <div>
      <PageHeader title="New programme" breadcrumbs={[{ label: "CSR Programmes", href: "/admin/programmes" }, { label: "New" }]} />
      <Card><CardBody><ProgrammeForm focusAreas={focusAreas} /></CardBody></Card>
    </div>
  );
}
