import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AdminShell } from "@/components/admin/shell";
import { getAccessibleOrganisations, getOrgContext, getSessionUser, ORG_COOKIE } from "@/server/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { unreadCount } from "@/server/services/notifications";
import { pendingApprovalCount } from "@/server/services/approvals";
import { newEnquiryCount } from "@/server/services/enquiries";
import { logoutAction } from "../(auth)/actions";
import { prisma } from "@/server/db";
import { publicMediaUrl } from "@/server/services/media";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s | OpenCSR" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function switchOrganisation(fd: FormData) {
  "use server";
  const id = String(fd.get("organisationId") ?? "");
  const orgs = await getAccessibleOrganisations();
  // Only organisations the user is a member of can be selected.
  if (orgs.some((o) => o.id === id)) {
    (await cookies()).set(ORG_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", secure: (process.env.APP_URL ?? "").startsWith("https://") });
  }
  redirect("/admin");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ctx = await getOrgContext();
  if (!ctx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">No organisation access</h1>
          <p className="mt-2 text-sm text-gray-600">Your account is not an active member of any organisation. Ask an administrator to add you.</p>
          <form action={logoutAction} className="mt-4"><button className="text-sm font-medium text-brand-700 underline">Sign out</button></form>
        </div>
      </div>
    );
  }
  const orgs = await getAccessibleOrganisations();
  const logo = ctx.organisation.logoId ? await prisma.mediaAsset.findFirst({ where: { id: ctx.organisation.logoId, organisationId: ctx.organisationId, visibility: "PUBLIC" } }) : null;
  const [notifications, approvals, enquiries] = await Promise.all([
    unreadCount(ctx),
    pendingApprovalCount(ctx),
    ctx.permissions.has("enquiry.read") ? newEnquiryCount(ctx) : Promise.resolve(0),
  ]);
  return (
    <AdminShell
      user={{ name: user.name, email: user.email, isPlatformAdmin: user.isPlatformAdmin }}
      organisation={{ id: ctx.organisationId, name: ctx.organisation.name, isDemo: ctx.organisation.isDemo || ctx.organisation.demoBannerEnabled, logoUrl: logo ? publicMediaUrl(logo) : null }}
      organisations={orgs.map((o) => ({ id: o.id, name: o.name }))}
      roleLabel={ROLE_LABELS[ctx.role]}
      permissions={[...ctx.permissions]}
      counts={{ notifications, approvals, enquiries }}
      switchOrganisation={switchOrganisation}
      logout={logoutAction}
    >
      {children}
    </AdminShell>
  );
}
