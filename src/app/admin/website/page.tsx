import Link from "next/link";
import { CloudUpload, ExternalLink, FileText, LayoutTemplate, MonitorSmartphone, Navigation, Newspaper, Palette, PanelsTopLeft, Settings2, Type } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { getBuilderState } from "@/server/services/website";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { getTemplate } from "@/lib/theme/templates";

export const metadata = { title: "Website Builder" };

const AREAS = [
  { href: "/admin/website/homepage", label: "Homepage", desc: "Add, edit, reorder and hide homepage sections.", icon: PanelsTopLeft },
  { href: "/admin/website/pages", label: "Pages", desc: "Create pages, manage SEO, revisions and publishing.", icon: FileText },
  { href: "/admin/website/theme", label: "Colours", desc: "Brand, page, button, card, navigation and footer colours.", icon: Palette },
  { href: "/admin/website/typography", label: "Typography", desc: "Fonts, sizes, weights and spacing.", icon: Type },
  { href: "/admin/website/header-footer", label: "Header & footer", desc: "Logo, favicon, layout, contact, social and legal links.", icon: Settings2 },
  { href: "/admin/website/navigation", label: "Navigation", desc: "Header menu with dropdowns, and footer menu.", icon: Navigation },
  { href: "/admin/website/blog-layout", label: "Blog layout", desc: "Grid, list or featured layouts and article options.", icon: Newspaper },
  { href: "/admin/website/templates", label: "Templates", desc: "Start from a complete theme. Previous theme is backed up.", icon: LayoutTemplate },
  { href: "/admin/website/preview", label: "Device preview", desc: "Preview every draft page on desktop, tablet and mobile.", icon: MonitorSmartphone },
  { href: "/admin/website/publish", label: "Publish & history", desc: "Publish drafts, discard changes and roll back versions.", icon: CloudUpload },
];

export default async function WebsiteOverview() {
  const ctx = await requireOrgContext("website.edit");
  const s = await getBuilderState(ctx);
  return (
    <div>
      <PageHeader
        title="Website Builder"
        description="Design and publish your public CSR website without code. Edits are saved as drafts; visitors only see what you publish."
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Website" }]}
        actions={
          <>
            <LinkButton href="/" target="_blank" variant="outline"><ExternalLink className="h-4 w-4" /> View live site</LinkButton>
            <LinkButton href="/admin/website/homepage">Open builder</LinkButton>
          </>
        }
      />
      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div>
            <p><strong>Live version:</strong> {s.publishedVersion ? `v${s.publishedVersion}, published ${formatDateTime(s.publishedAt)}` : "never published"}</p>
            <p><strong>Theme base:</strong> {getTemplate(s.templateKey)?.name ?? "Custom"} · <strong>Pages:</strong> {s.pages.length}</p>
          </div>
          <div className="flex items-center gap-3">
            {s.hasUnpublishedChanges ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Unpublished draft changes</span> : <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-900">Live site is up to date</span>}
            <LinkButton href="/admin/website/publish" variant="outline">Publish…</LinkButton>
          </div>
        </CardBody>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {AREAS.map((a) => (
          <Link key={a.href} href={a.href} className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-brand-600">
            <a.icon className="h-6 w-6 text-brand-700" aria-hidden />
            <p className="mt-3 font-semibold text-gray-900 group-hover:underline">{a.label}</p>
            <p className="mt-1 text-sm text-gray-600">{a.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
