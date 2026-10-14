import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser, ORG_COOKIE } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { runAction, type ActionState } from "@/server/action";
import { createOrganisation, CURRENCIES, deleteOrganisation, setDefaultOrganisation } from "@/server/services/organisations";
import { formDataToObject } from "@/lib/zod-helpers";
import { THEME_TEMPLATES } from "@/lib/theme/templates";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { UnauthenticatedError } from "@/server/errors";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Organisations" };

async function createOrgAction(_: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  let id = "";
  const res = await runAction(async () => {
    const u = await getSessionUser();
    if (!u) throw new UnauthenticatedError();
    id = (await createOrganisation(u, formDataToObject(fd))).id;
  });
  if (res.ok) {
    (await cookies()).set(ORG_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
    redirect("/admin?welcome=1");
  }
  return res;
}

async function deleteOrgAction(_: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  return runAction(async () => {
    const u = await getSessionUser();
    if (!u) throw new UnauthenticatedError();
    await deleteOrganisation(u, String(fd.get("id")), String(fd.get("confirmName") ?? ""));
  }, "Organisation deleted");
}

async function defaultOrgAction(_: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  return runAction(async () => {
    const u = await getSessionUser();
    if (!u) throw new UnauthenticatedError();
    await setDefaultOrganisation(u, String(fd.get("id")));
  }, "Default website organisation updated");
}

export default async function PlatformPage() {
  const user = await getSessionUser();
  if (!user?.isPlatformAdmin) redirect("/admin/forbidden");
  const [orgs, settings] = await Promise.all([
    prisma.organisation.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { memberships: true, projects: true } }, websiteSettings: { select: { domain: true } } } }),
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
  ]);
  return (
    <div>
      <PageHeader title="Organisations" description="Platform administration. Each organisation's data, users, branding and website are isolated." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Organisations" }]} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Table caption="Organisations">
            <thead><tr><Th>Name</Th><Th>Members</Th><Th>Projects</Th><Th>Website</Th><Th>Created</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {orgs.map((o) => (
                <Tr key={o.id}>
                  <Td><p className="font-medium">{o.name} {o.isDemo ? <Badge tone="amber">Demo</Badge> : null} {settings?.defaultOrganisationId === o.id ? <Badge tone="green">Default site</Badge> : null}</p><p className="text-xs text-gray-500">/{o.slug}</p></Td>
                  <Td>{o._count.memberships}</Td>
                  <Td>{o._count.projects}</Td>
                  <Td className="text-xs">{o.websiteSettings?.domain ?? "default host"}</Td>
                  <Td className="text-xs">{formatDate(o.createdAt)}</Td>
                  <Td className="whitespace-nowrap text-right">
                    {settings?.defaultOrganisationId !== o.id ? <ActionButton action={defaultOrgAction} fields={{ id: o.id }} variant="ghost">Make default site</ActionButton> : null}
                    <Dialog trigger="Delete" title={`Delete ${o.name}`} triggerSize="sm" triggerVariant="ghost">
                      <ActionForm action={deleteOrgAction} className="space-y-3">
                        <p className="text-sm text-red-800">This permanently deletes the organisation, its users&apos; memberships, projects, finances, documents, files, website and history. This cannot be undone. Take a backup first.</p>
                        <input type="hidden" name="id" value={o.id} />
                        <TextField label={`Type “${o.name}” to confirm`} name="confirmName" required />
                        <SubmitButton variant="danger">Delete permanently</SubmitButton>
                      </ActionForm>
                    </Dialog>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
        <Card>
          <CardHeader title="Create organisation" description="You will become its administrator." />
          <CardBody>
            <ActionForm action={createOrgAction} className="space-y-3">
              <TextField label="Name" name="name" required />
              <TextField label="Slug" name="slug" required pattern="[a-z0-9-]+" />
              <TextField label="Tagline" name="tagline" />
              <TextField label="Public email" name="email" type="email" />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Currency" name="currency" defaultValue="INR" options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                <TextField label="FY start month" name="financialYearStartMonth" type="number" min={1} max={12} defaultValue={4} />
              </div>
              <SelectField label="Theme" name="templateKey" defaultValue="corporate-green" options={THEME_TEMPLATES.map((t) => ({ value: t.key, label: t.name }))} />
              <input type="hidden" name="timezone" value="Asia/Kolkata" />
              <input type="hidden" name="locale" value="en-IN" />
              <SubmitButton size="sm">Create organisation</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
