import { requireUser } from "@/server/auth/session";
import { runAction, type ActionState } from "@/server/action";
import { changeOwnPassword, updateProfile } from "@/server/services/users";
import { getSessionUser } from "@/server/auth/session";
import { formDataToObject } from "@/lib/zod-helpers";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { UnauthenticatedError } from "@/server/errors";
import { redirect } from "next/navigation";

export const metadata = { title: "My account" };

async function profileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  return runAction(async () => {
    const u = await getSessionUser();
    if (!u) throw new UnauthenticatedError();
    await updateProfile(u, formDataToObject(fd));
  }, "Profile saved");
}

async function passwordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  const res = await runAction(async () => {
    const u = await getSessionUser();
    if (!u) throw new UnauthenticatedError();
    await changeOwnPassword(u, formDataToObject(fd));
  });
  if (res.ok) redirect("/login?reset=1");
  return res;
}

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="My account" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Account" }]} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" description={user.email} />
          <CardBody>
            <ActionForm action={profileAction} className="space-y-3">
              <TextField label="Name" name="name" defaultValue={user.name} required />
              <SubmitButton size="sm">Save</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Change password" description="You will be signed out of all devices." />
          <CardBody>
            <ActionForm action={passwordAction} className="space-y-3">
              <TextField label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
              <TextField label="New password" name="newPassword" type="password" autoComplete="new-password" required hint="At least 10 characters, mixing letters with numbers or symbols." />
              <SubmitButton size="sm">Change password</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
