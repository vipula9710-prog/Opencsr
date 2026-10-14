import { requireOrgContext } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ReportForm } from "../form";
import { reportOptions } from "../options";

export const metadata = { title: "New report" };

export default async function NewReportPage() {
  const ctx = await requireOrgContext("report.write");
  const opts = await reportOptions(ctx);
  return (
    <div>
      <PageHeader title="New report" breadcrumbs={[{ label: "Reports", href: "/admin/reports" }, { label: "New" }]} />
      <Card><CardBody><ReportForm {...opts} /></CardBody></Card>
    </div>
  );
}
