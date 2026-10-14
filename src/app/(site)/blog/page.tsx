import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { publicPosts, publicPostWhere } from "@/server/services/public-site-blog";
import { PostCard } from "@/components/site/cards";
import { getSite } from "../site-data";
import { PageHero } from "../page-hero";

type SP = Promise<{ page?: string; category?: string; tag?: string; q?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const site = await getSite();
  const sp = await searchParams;
  return { title: site?.site.config.pages.blog.title || "Blog", alternates: { canonical: sp.category ? `/blog?category=${sp.category}` : "/blog" }, robots: sp.q ? { index: false } : undefined };
}

export default async function BlogIndex({ searchParams }: { searchParams: SP }) {
  const site = await getSite();
  if (!site) notFound();
  const sp = await searchParams;
  const b = site.site.config.blog;
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const q = sp.q?.slice(0, 100);
  const { posts, total } = await publicPosts(site.organisation.id, { take: b.postsPerPage, skip: (page - 1) * b.postsPerPage, categorySlug: sp.category, tagSlug: sp.tag, q });
  const categories = await prisma.category.findMany({ where: { organisationId: site.organisation.id, posts: { some: publicPostWhere(site.organisation.id) } }, orderBy: { name: "asc" }, select: { name: true, slug: true } });
  const pages = Math.max(1, Math.ceil(total / b.postsPerPage));
  const opts = { showAuthor: b.showAuthor, showCategories: b.showCategories, showDate: b.showDate, showReadingTime: b.showReadingTime, cardStyle: b.cardStyle, imageAspect: b.imageAspect };
  const [featured, ...rest] = b.layout === "featured" && page === 1 ? posts : [undefined, ...posts];
  const link = (p: number) => `/blog?${new URLSearchParams(Object.entries({ page: String(p), category: sp.category ?? "", tag: sp.tag ?? "", q: q ?? "" }).filter(([, v]) => v))}`;
  const p = site.site.config.pages.blog;
  return (
    <>
      <PageHero title={p.title || "News & stories"} intro={p.intro} />
      <section className="section-pt-sm section-pb-md">
        <div className={`site-container grid gap-10 ${b.sidebar ? "@4xl:grid-cols-4" : ""}`}>
          <div className={b.sidebar ? "@4xl:col-span-3" : ""}>
            {sp.category || sp.tag || q ? <p className="mb-6 text-sm">Showing posts {sp.category ? `in “${categories.find((c) => c.slug === sp.category)?.name ?? sp.category}”` : ""}{sp.tag ? ` tagged “${sp.tag}”` : ""}{q ? ` matching “${q}”` : ""} · <a href="/blog" className="site-link">Clear</a></p> : null}
            {posts.length === 0 ? <p>No posts found.</p> : (
              <>
                {featured ? <div className="mb-8"><PostCard post={featured} options={{ ...opts, horizontal: true }} /></div> : null}
                {b.layout === "list" ? (
                  <div className="grid gap-6">{rest.map((post) => post && <PostCard key={post.id} post={post} options={{ ...opts, horizontal: true }} />)}</div>
                ) : (
                  <div className="site-grid" style={{ ["--cols" as string]: String(b.columns) }}>{rest.map((post) => post && <PostCard key={post.id} post={post} options={opts} />)}</div>
                )}
              </>
            )}
            {pages > 1 ? (
              <nav aria-label="Pagination" className="mt-10 flex items-center justify-between">
                {page > 1 ? <a href={link(page - 1)} className="site-btn site-btn-secondary" rel="prev">Newer posts</a> : <span />}
                <span className="text-sm">Page {page} of {pages}</span>
                {page < pages ? <a href={link(page + 1)} className="site-btn site-btn-secondary" rel="next">Older posts</a> : <span />}
              </nav>
            ) : null}
          </div>
          {b.sidebar ? (
            <aside className="space-y-8">
              <form action="/blog" method="get" role="search">
                <label htmlFor="blog-search" className="mb-1 block text-sm font-semibold">Search</label>
                <input id="blog-search" name="q" defaultValue={q} className="site-input" type="search" />
              </form>
              {categories.length ? (
                <div>
                  <h2 className="mb-3 text-lg">Categories</h2>
                  <ul className="space-y-2 text-sm">{categories.map((c) => <li key={c.slug}><a className="site-link" href={`/blog?category=${c.slug}`} aria-current={sp.category === c.slug ? "page" : undefined}>{c.name}</a></li>)}</ul>
                </div>
              ) : null}
              <p className="text-sm"><a className="site-link" href="/rss.xml">RSS feed</a></p>
            </aside>
          ) : null}
        </div>
      </section>
    </>
  );
}
