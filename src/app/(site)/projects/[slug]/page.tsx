import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { publicMediaUrl } from "@/server/services/media";
import { publicIndicators } from "@/server/services/public-site";
import { RichText } from "@/components/site/primitives";
import { formatDate, humanize, stripHtml, truncate } from "@/lib/utils";
import { getSite } from "../../site-data";

type Props = { params: Promise<{ slug: string }> };

/** Only explicitly published, non-draft projects; internal notes, risks and private files are never loaded. */
async function loadProject(slug: string) {
  const site = await getSite();
  if (!site) return null;
  const project = await prisma.project.findFirst({
    where: { organisationId: site.organisation.id, slug, isPublic: true, status: { notIn: ["DRAFT", "ARCHIVED"] } },
    select: {
      id: true, title: true, slug: true, summary: true, publicSummary: true, description: true, objectives: true, location: true, startDate: true, endDate: true, status: true,
      focusArea: { select: { name: true } },
      programme: { select: { name: true } },
      partner: { select: { name: true } },
      coverImage: { select: { id: true, filename: true, altText: true, visibility: true } },
      media: { where: { isPublic: true, mediaAsset: { visibility: "PUBLIC" } }, orderBy: { sortOrder: "asc" }, select: { caption: true, mediaAsset: { select: { id: true, filename: true, altText: true, mimeType: true } } } },
    },
  });
  return project ? { site, project } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await loadProject((await params).slug);
  if (!r) return {};
  const desc = r.project.publicSummary ?? r.project.summary ?? truncate(stripHtml(r.project.description), 160);
  const cover = r.project.coverImage?.visibility === "PUBLIC" ? publicMediaUrl(r.project.coverImage) : undefined;
  return { title: r.project.title, description: desc, alternates: { canonical: `/projects/${r.project.slug}` }, openGraph: { title: r.project.title, description: desc, images: cover ? [cover] : undefined } };
}

export default async function ProjectPage({ params }: Props) {
  const r = await loadProject((await params).slug);
  if (!r) notFound();
  const { project, site } = r;
  const indicators = (await publicIndicators(site.organisation.id)).filter(Boolean);
  const projectIndicators = await prisma.impactIndicator.findMany({ where: { projectId: project.id, isPublic: true }, select: { id: true } });
  const shown = indicators.filter((i) => projectIndicators.some((p) => p.id === i.id));
  const cover = project.coverImage?.visibility === "PUBLIC" ? publicMediaUrl(project.coverImage) : null;
  return (
    <article>
      <section className="section-pt-md section-pb-sm" style={{ background: "var(--c-surface-alt)" }}>
        <div className="site-container">
          <p className="text-sm"><a href="/projects" className="site-link">← All projects</a></p>
          <div className="mt-4 flex flex-wrap gap-2">
            {project.focusArea ? <span className="site-badge">{project.focusArea.name}</span> : null}
            <span className="site-badge">{humanize(project.status)}</span>
          </div>
          <h1 className="mt-3">{project.title}</h1>
          {project.publicSummary || project.summary ? <p className="mt-4 max-w-3xl text-lg">{project.publicSummary || project.summary}</p> : null}
        </div>
      </section>
      <section className="section-pt-sm section-pb-md">
        <div className="site-container grid gap-10 @4xl:grid-cols-3">
          <div className="space-y-8 @4xl:col-span-2">
            {cover ? <img src={cover} alt={project.coverImage?.altText ?? ""} className="site-img" /> : null}
            {project.description ? <RichText html={project.description} /> : null}
            {project.objectives ? (
              <div><h2 className="mb-3">Objectives</h2><p className="whitespace-pre-line">{project.objectives}</p></div>
            ) : null}
            {project.media.length ? (
              <div>
                <h2 className="mb-4">Gallery</h2>
                <ul className="grid gap-4 @2xl:grid-cols-2">
                  {project.media.filter((m) => m.mediaAsset.mimeType.startsWith("image/")).map((m) => (
                    <li key={m.mediaAsset.id}><figure><img src={publicMediaUrl(m.mediaAsset)} alt={m.mediaAsset.altText ?? m.caption ?? ""} className="site-img" loading="lazy" />{m.caption ? <figcaption className="mt-1 text-sm" style={{ color: "var(--c-muted)" }}>{m.caption}</figcaption> : null}</figure></li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <aside className="space-y-6">
            <div className="site-card p-6">
              <h2 className="mb-4 text-xl">Project details</h2>
              <dl className="space-y-3 text-sm">
                {project.location ? <div><dt className="font-semibold">Location</dt><dd>{project.location}</dd></div> : null}
                {project.programme ? <div><dt className="font-semibold">Programme</dt><dd>{project.programme.name}</dd></div> : null}
                {project.partner ? <div><dt className="font-semibold">Implementation partner</dt><dd>{project.partner.name}</dd></div> : null}
                {project.startDate ? <div><dt className="font-semibold">Timeline</dt><dd>{formatDate(project.startDate)}{project.endDate ? ` – ${formatDate(project.endDate)}` : ""}</dd></div> : null}
              </dl>
            </div>
            {shown.length ? (
              <div className="site-card p-6">
                <h2 className="mb-4 text-xl">Verified results</h2>
                <ul className="space-y-3 text-sm">
                  {shown.map((i) => <li key={i.id}><p className="text-2xl font-bold" style={{ color: "var(--c-primary)" }}>{Number(i.value).toLocaleString("en-IN")}</p><p>{i.name} ({i.unit})</p><p className="text-xs" style={{ color: "var(--c-muted)" }}>Verified · period ending {formatDate(i.periodEnd)}</p></li>)}
                </ul>
                {site.demo ? <p className="mt-3 text-xs font-semibold">Demo content: figures are fictional.</p> : null}
              </div>
            ) : null}
            <a href="/contact" className="site-btn site-btn-primary w-full">Get in touch</a>
          </aside>
        </div>
      </section>
    </article>
  );
}
