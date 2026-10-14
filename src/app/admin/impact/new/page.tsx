import { requireOrgContext } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { IndicatorForm } from "../form";
import { indicatorOptions } from "../options";

export const metadata = { title: "New indicator" };

export default async function NewIndicatorPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const ctx = await requireOrgContext("impact.write");
  const opts = await indicatorOptions(ctx);
  const sp = await searchParams;
  return (
    <div>
      <PageHeader title="New impact indicator" breadcrumbs={[{ label: "Impact", href: "/admin/impact" }, { label: "New" }]} />
      <Card><CardBody><IndicatorForm {...opts} defaults={{ projectId: sp.projectId }} /></CardBody></Card>
    </div>
  );
}
