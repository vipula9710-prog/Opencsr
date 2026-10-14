import { requireOrgContext } from "@/server/auth/session";
import { listMembers } from "@/server/services/users";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS, ROLES } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import { addMemberAction, removeMemberAction, resetLinkAction, updateMemberAction } from "./actions";

export const metadata = { title: "Users & Roles" };

export default async function UsersPage() {
  const ctx = await requireOrgContext("users.manage");
  const members = await listMembers(ctx);
  const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  return (
    <div>
      <PageHeader title="Users & Roles" description="There is no public registration — administrators add members here. Each member has exactly one role in this organisation." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Users" }]} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Table caption="Members">
            <thead><tr><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Last sign-in</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <Tr key={m.id}>
                  <Td><p className="font-medium">{m.user.name} {m.user.isPlatformAdmin ? <Badge tone="purple">Platform admin</Badge> : null}</p><p className="text-xs text-gray-500">{m.user.email}</p></Td>
                  <Td>{ROLE_LABELS[m.role]}</Td>
                  <Td>{m.isActive && m.user.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Deactivated</Badge>}</Td>
                  <Td className="text-xs">{formatDateTime(m.user.lastLoginAt)}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <Dialog trigger="Manage" title={`Manage ${m.user.name}`} triggerSize="sm">
                      <div className="space-y-5">
                        <ActionForm action={updateMemberAction} className="space-y-3">
                          <input type="hidden" name="id" value={m.id} />
                          <SelectField label="Role" name="role" defaultValue={m.role} options={roleOptions} />
                          <SelectField label="Access" name="isActive" defaultValue={String(m.isActive)} options={[{ value: "true", label: "Active" }, { value: "false", label: "Deactivated" }]} />
                          <SubmitButton size="sm">Save</SubmitButton>
                        </ActionForm>
                        <div className="border-t border-gray-100 pt-3"><ActionButton action={resetLinkAction} fields={{ userId: m.userId }}>Generate password reset link</ActionButton></div>
                        {m.userId !== ctx.user.id ? <div className="border-t border-gray-100 pt-3"><ActionButton action={removeMemberAction} fields={{ id: m.id }} variant="danger" confirm="Remove this member from the organisation?">Remove from organisation</ActionButton></div> : null}
                      </div>
                    </Dialog>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
        <Card>
          <CardHeader title="Add member" />
          <CardBody>
            <ActionForm action={addMemberAction} className="space-y-3" resetOnSuccess>
              <TextField label="Full name" name="name" required />
              <TextField label="Email" name="email" type="email" required />
              <SelectField label="Role" name="role" defaultValue="VIEWER" options={roleOptions} />
              <TextField label="Temporary password (optional)" name="password" type="password" autoComplete="new-password" hint="Leave empty to generate a one-time set-password link instead." />
              <SubmitButton size="sm">Add member</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Roles and permissions" description="Least-privilege defaults. Authors cannot publish; content editors cannot see finances." />
        <CardBody className="grid gap-4 md:grid-cols-2">
          {ROLES.map((r) => (
            <details key={r} className="rounded-lg border border-gray-200 p-3">
              <summary className="cursor-pointer text-sm font-medium">{ROLE_LABELS[r]}</summary>
              <p className="mt-1 text-sm text-gray-600">{ROLE_DESCRIPTIONS[r]}</p>
              <p className="mt-2 text-xs text-gray-500">{ROLE_PERMISSIONS[r].join(", ")}</p>
            </details>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
