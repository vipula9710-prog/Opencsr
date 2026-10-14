import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { publicProjects } from "@/server/services/public-site";
import { ProjectCard } from "@/components/site/cards";
import { getSite } from "../site-data";
import { PageHero } from "../page-hero";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return { title: site?.site.config.pages.projects.title || "Projects", alternates: { canonical: "/projects" } };
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const site = await getSite();
  if (!site) notFound();
  const { area } = await searchParams;
  const [projects, areas] = await Promise.all([
    publicProjects(site.organisation.id, { focusAreaSlug: area }),
    prisma.focusArea.findMany({ where: { organisationId: site.organisation.id, isPublic: true, projects: { some: { isPublic: true } } }, orderBy: { sortOrder: "asc" }, select: { name: true, slug: true } }),
  ]);
  const p = site.site.config.pages.projects;
  return (
    <>
      <PageHero title={p.title || "Our projects"} intro={p.intro} />
      <section className="section-pt-sm section-pb-md">
        <div className="site-container">
          {areas.length ? (
            <nav aria-label="Filter by focus area" className="mb-8 flex flex-wrap gap-2">
              <a href="/projects" className="site-badge" aria-current={!area ? "page" : undefined} style={!area ? { background: "var(--c-primary)", color: "var(--c-button-text)" } : undefined}>All</a>
              {areas.map((a) => <a key={a.slug} href={`/projects?area=${a.slug}`} className="site-badge" aria-current={area === a.slug ? "page" : undefined} style={area === a.slug ? { background: "var(--c-primary)", color: "var(--c-button-text)" } : undefined}>{a.name}</a>)}
            </nav>
          ) : null}
          {projects.length === 0 ? <p>No projects have been published yet.</p> : <div className="site-grid">{projects.map((proj) => <ProjectCard key={proj.id} project={proj} showStatus />)}</div>}
        </div>
      </section>
    </>
  );
}
