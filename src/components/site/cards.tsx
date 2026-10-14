import type { PublicPost, PublicProject } from "@/lib/site/section-data";
import { formatDate, humanize } from "@/lib/utils";

export function ProjectCard({ project, showStatus, showSummary = true }: { project: PublicProject; showStatus?: boolean; showSummary?: boolean }) {
  return (
    <article className="site-card flex h-full flex-col text-left">
      {project.coverUrl ? <img src={project.coverUrl} alt={project.coverAlt} className="site-img" style={{ borderRadius: 0 }} loading="lazy" /> : <div className="site-img" style={{ background: "var(--c-surface-alt)", borderRadius: 0 }} aria-hidden />}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap gap-2">
          {project.focusArea ? <span className="site-badge">{project.focusArea}</span> : null}
          {showStatus ? <span className="site-badge">{humanize(project.status)}</span> : null}
        </div>
        <h3 className="text-xl"><a href={`/projects/${project.slug}`} className="hover:underline">{project.title}</a></h3>
        {project.location ? <p className="text-sm" style={{ color: "var(--c-muted)" }}>{project.location}</p> : null}
        {showSummary && project.summary ? <p className="text-sm">{project.summary}</p> : null}
        <a href={`/projects/${project.slug}`} className="site-link mt-auto pt-2 text-sm font-semibold" aria-label={`Read more about ${project.title}`}>Read more →</a>
      </div>
    </article>
  );
}

export function PostCard({ post, options }: { post: PublicPost; options: { showCategories: boolean; showAuthor: boolean; showDate: boolean; showReadingTime: boolean; cardStyle: string; imageAspect?: string; horizontal?: boolean } }) {
  const style = options.cardStyle === "minimal" ? { background: "transparent", border: 0, boxShadow: "none" } : options.cardStyle === "bordered" ? { boxShadow: "none" } : undefined;
  const meta = [options.showDate && post.publishedAt ? formatDate(post.publishedAt) : null, options.showAuthor && post.authorName ? post.authorName : null, options.showReadingTime ? `${post.readingMinutes} min read` : null].filter(Boolean);
  return (
    <article className={`site-card flex h-full text-left ${options.horizontal ? "flex-col @2xl:flex-row" : "flex-col"}`} style={style}>
      {post.imageUrl ? (
        <img src={post.imageUrl} alt={post.imageAlt} className={`site-img ${options.horizontal ? "@2xl:w-2/5" : ""}`} style={{ borderRadius: options.cardStyle === "minimal" ? undefined : 0, aspectRatio: options.imageAspect?.replace("/", " / ") }} loading="lazy" />
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-5">
        {options.showCategories && post.categories.length ? (
          <div className="flex flex-wrap gap-2">{post.categories.map((c) => <a key={c.slug} href={`/blog?category=${c.slug}`} className="site-badge">{c.name}</a>)}</div>
        ) : null}
        <h3 className="text-xl"><a href={`/blog/${post.slug}`} className="hover:underline">{post.title}</a></h3>
        {meta.length ? <p className="text-xs" style={{ color: "var(--c-muted)" }}>{meta.join(" · ")}</p> : null}
        {post.excerpt ? <p className="text-sm">{post.excerpt}</p> : null}
      </div>
    </article>
  );
}
