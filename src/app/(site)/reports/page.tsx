import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicReportItems } from "@/server/services/public-site";
import { formatDate } from "@/lib/utils";
import { getSite } from "../site-data";
import { PageHero } from "../page-hero";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return { title: site?.site.config.pages.reports.title || "Reports", alternates: { canonical: "/reports" } };
}

export default async function ReportsPage() {
  const site = await getSite();
  if (!site) notFound();
  const items = await publicReportItems(site.organisation.id, 200);
  const p = site.site.config.pages.reports;
  return (
    <>
      <PageHero title={p.title || "Reports & documents"} intro={p.intro} />
      <section className="section-pt-sm section-pb-md">
        <div className="site-container">
          {items.length === 0 ? <p>No reports have been published yet.</p> : (
            <ul className="grid gap-4 @3xl:grid-cols-2">
              {items.map((r) => (
                <li key={r.id} className="site-card flex flex-col gap-3 p-6">
                  <span className="site-badge self-start capitalize">{r.label}</span>
                  <h2 className="text-xl">{r.title}</h2>
                  {r.description ? <p className="text-sm">{r.description}</p> : null}
                  {r.date ? <p className="text-xs" style={{ color: "var(--c-muted)" }}>{formatDate(r.date)}</p> : null}
                  <a href={r.href} className="site-btn site-btn-secondary self-start">{r.label === "Report" ? "Read report" : "Download"}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
