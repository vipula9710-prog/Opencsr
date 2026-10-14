import { requireOrgContext } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { TaskForm } from "../form";
import { taskFormOptions } from "../options";

export const metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ projectId?: string; partnerId?: string }> }) {
  const ctx = await requireOrgContext("task.write");
  const opts = await taskFormOptions(ctx);
  const sp = await searchParams;
  return (
    <div>
      <PageHeader title="New task" breadcrumbs={[{ label: "Tasks", href: "/admin/tasks" }, { label: "New" }]} />
      <Card><CardBody><TaskForm {...opts} defaults={sp} /></CardBody></Card>
    </div>
  );
}
