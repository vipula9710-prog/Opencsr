// Role-based access control definitions. This module is shared by the server
// (authoritative checks) and the client (only for hiding UI that the user
// cannot use — never for enforcement).

export const PERMISSIONS = [
  "org.settings.manage",
  "users.manage",
  "audit.read",
  "programme.read",
  "programme.write",
  "project.read",
  "project.write",
  "project.archive",
  "partner.read",
  "partner.write",
  "partner.confidential",
  "partner.verify",
  "finance.read",
  "finance.write",
  "finance.approve",
  "impact.read",
  "impact.write",
  "impact.verify",
  "task.read",
  "task.write",
  "document.read",
  "document.write",
  "document.confidential",
  "report.read",
  "report.write",
  "report.approve",
  "approval.review",
  "website.edit",
  "website.publish",
  "blog.write",
  "blog.edit_any",
  "blog.publish",
  "blog.taxonomy",
  "media.read",
  "media.write",
  "enquiry.read",
  "enquiry.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "ORG_ADMIN",
  "CSR_MANAGER",
  "PROJECT_MANAGER",
  "FINANCE_MANAGER",
  "REVIEWER",
  "CONTENT_EDITOR",
  "AUTHOR",
  "VIEWER",
] as const;

export type RoleName = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleName | "PLATFORM_ADMIN", string> = {
  PLATFORM_ADMIN: "Platform Administrator",
  ORG_ADMIN: "Organisation Administrator",
  CSR_MANAGER: "CSR Manager",
  PROJECT_MANAGER: "Project Manager",
  FINANCE_MANAGER: "Finance Manager",
  REVIEWER: "Reviewer",
  CONTENT_EDITOR: "Content Editor",
  AUTHOR: "Author",
  VIEWER: "Read-only Viewer",
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  ORG_ADMIN: "Full control of this organisation, including users, settings and publishing.",
  CSR_MANAGER: "Manages programmes, projects, partners, impact, reports and approvals. Read access to finance.",
  PROJECT_MANAGER: "Manages projects, tasks, milestones and impact data. No financial write access.",
  FINANCE_MANAGER: "Manages budgets, expenditure and disbursements. Read access to projects.",
  REVIEWER: "Reviews and approves reports, impact measurements and other submissions.",
  CONTENT_EDITOR: "Edits the public website and all blog posts, and publishes content. No finance access.",
  AUTHOR: "Writes and edits their own blog posts. Cannot publish.",
  VIEWER: "Read-only access to non-confidential programme and project information.",
};

const READ_CORE: Permission[] = [
  "programme.read",
  "project.read",
  "partner.read",
  "impact.read",
  "task.read",
  "document.read",
  "report.read",
  "media.read",
];

export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  ORG_ADMIN: PERMISSIONS,
  CSR_MANAGER: [
    ...READ_CORE,
    "audit.read",
    "programme.write",
    "project.write",
    "project.archive",
    "partner.write",
    "partner.confidential",
    "partner.verify",
    "finance.read",
    "impact.write",
    "impact.verify",
    "task.write",
    "document.write",
    "document.confidential",
    "report.write",
    "report.approve",
    "approval.review",
    "media.write",
    "enquiry.read",
    "enquiry.manage",
  ],
  PROJECT_MANAGER: [
    ...READ_CORE,
    "project.write",
    "impact.write",
    "task.write",
    "document.write",
    "report.write",
    "media.write",
  ],
  FINANCE_MANAGER: [
    ...READ_CORE,
    "finance.read",
    "finance.write",
    "finance.approve",
    "document.write",
    "document.confidential",
    "report.write",
    "task.write",
    "media.write",
  ],
  REVIEWER: [
    ...READ_CORE,
    "finance.read",
    "partner.confidential",
    "document.confidential",
    "report.approve",
    "impact.verify",
    "approval.review",
    "task.write",
  ],
  CONTENT_EDITOR: [
    "programme.read",
    "project.read",
    "impact.read",
    "report.read",
    "website.edit",
    "website.publish",
    "blog.write",
    "blog.edit_any",
    "blog.publish",
    "blog.taxonomy",
    "media.read",
    "media.write",
    "enquiry.read",
    "enquiry.manage",
  ],
  AUTHOR: ["blog.write", "media.read", "media.write"],
  VIEWER: READ_CORE.filter((p) => p !== "media.read"),
};

export function permissionsForRole(role: RoleName | "PLATFORM_ADMIN"): Set<Permission> {
  if (role === "PLATFORM_ADMIN") return new Set(PERMISSIONS);
  return new Set(ROLE_PERMISSIONS[role]);
}
