import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import { prisma } from "@/server/db";
import { getOrgContext } from "@/server/auth/session";
import { publicPostWhere, publicPosts } from "@/server/services/public-site-blog";
import { publicMediaUrl } from "@/server/services/media";
import { PostCard } from "@/components/site/cards";
import { RichText } from "@/components/site/primitives";
import { formatDate } from "@/lib/utils";
import { getSite, baseUrl } from "../../site-data";

type Props = { params: Promise<{ slug: string }> };

/** Published posts for everyone; drafts only in draft mode for signed-in authors/editors of the same organisation. */
async function loadPost(slug: string) {
  const site = await getSite();
  if (!site) return null;
  const include = { featuredImage: true, ogImage: true, author: { select: { id: true, name: true } }, categories: { select: { id: true, name: true, slug: true } }, tags: { select: { name: true, slug: true } } } as const;
  let post = await prisma.blogPost.findFirst({ where: { AND: [publicPostWhere(site.organisation.id), { slug }] }, include });
  let draft = false;
  if (!post && (await draftMode()).isEnabled) {
    const ctx = await getOrgContext();
    if (ctx && ctx.organisationId === site.organisation.id && ctx.permissions.has("blog.write")) {
      const candidate = await prisma.blogPost.findFirst({ where: { organisationId: ctx.organisationId, slug }, include });
      if (candidate && (candidate.authorId === ctx.user.id || ctx.permissions.has("blog.edit_any"))) {
        post = candidate;
        draft = true;
      }
    }
  }
  if (!post) return null;
  const profile = post.authorId ? await prisma.authorProfile.findUnique({ where: { organisationId_userId: { organisationId: site.organisation.id, userId: post.authorId } }, include: { avatar: true } }) : null;
  return { site, post, draft, profile };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await loadPost((await params).slug);
  if (!r) return {};
  const { post } = r;
  const image = post.ogImage ?? post.featuredImage;
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || undefined,
    alternates: { canonical: post.canonicalUrl || `/blog/${post.slug}` },
    robots: r.draft ? { index: false } : undefined,
    openGraph: { type: "article", title: post.seoTitle || post.title, description: post.seoDescription || post.excerpt || undefined, publishedTime: (post.publishedAt ?? post.scheduledFor)?.toISOString(), images: image?.visibility === "PUBLIC" ? [publicMediaUrl(image)] : undefined },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const r = await loadPost((await params).slug);
  if (!r) notFound();
  const { post, site, draft, profile } = r;
  const b = site.site.config.blog;
  const base = await baseUrl();
  const url = `${base}/blog/${post.slug}`;
  const published = post.publishedAt ?? post.scheduledFor;
  const authorName = profile?.displayName ?? post.author?.name ?? null;
  const related = b.showRelated && post.categories.length
    ? (await publicPosts(site.organisation.id, { take: 3, categorySlug: post.categories[0]!.slug, excludeId: post.id })).posts
    : [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: published?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: authorName ? { "@type": "Person", name: authorName } : undefined,
    publisher: { "@type": "Organization", name: site.site.config.identity.siteName },
    image: post.featuredImage?.visibility === "PUBLIC" ? `${base}${publicMediaUrl(post.featuredImage)}` : undefined,
    mainEntityOfPage: url,
    description: post.excerpt ?? undefined,
  };
  const width = b.articleWidth === "wide" ? "w-wide" : b.articleWidth === "normal" ? "" : "w-narrow";
  const fontSize = b.articleFontSize === "lg" ? "1.15em" : b.articleFontSize === "sm" ? "0.95em" : "1.05em";
  return (
    <article>
      {/* Structured data is JSON-encoded with "<" escaped, so it cannot break out of the script element. */}
      {!draft ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /> : null}
      {draft ? <div role="status" className="bg-amber-200 px-4 py-2 text-center text-sm font-medium text-amber-950">Draft preview — this post is not published ({post.status.toLowerCase()}).</div> : null}
      <header className="section-pt-md section-pb-sm" style={{ background: "var(--c-surface-alt)" }}>
        <div className={`site-container ${width}`}>
          <p className="text-sm"><a className="site-link" href="/blog">← All posts</a></p>
          {b.showCategories && post.categories.length ? <div className="mt-4 flex flex-wrap gap-2">{post.categories.map((c) => <a key={c.slug} href={`/blog?category=${c.slug}`} className="site-badge">{c.name}</a>)}</div> : null}
          <h1 className="mt-3">{post.title}</h1>
          <p className="mt-4 text-sm" style={{ color: "var(--c-muted)" }}>
            {[b.showDate && published ? <time key="d" dateTime={published.toISOString()}>{formatDate(published)}</time> : null, b.showAuthor && authorName ? <span key="a">By {authorName}</span> : null, b.showReadingTime ? <span key="r">{post.readingMinutes} min read</span> : null]
              .filter(Boolean)
              .reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, " · ", el] : [el]), [])}
          </p>
        </div>
      </header>
      <section className="section-pt-sm section-pb-md">
        <div className={`site-container ${width}`}>
          {post.featuredImage?.visibility === "PUBLIC" ? <img src={publicMediaUrl(post.featuredImage)} alt={post.featuredImage.altText ?? ""} className="site-img mb-8" /> : null}
          <div style={{ fontSize }}><RichText html={post.content} /></div>
          {post.tags.length ? <p className="mt-8 flex flex-wrap gap-2 text-sm">{post.tags.map((t) => <a key={t.slug} href={`/blog?tag=${t.slug}`} className="site-badge">#{t.name}</a>)}</p> : null}
          {b.showShare ? (
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6 text-sm" style={{ borderColor: "var(--c-border)" }}>
              <span className="font-semibold">Share:</span>
              <a className="site-link" target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}>LinkedIn</a>
              <a className="site-link" target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`}>X</a>
              <a className="site-link" target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}>Facebook</a>
              <a className="site-link" href={`mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(url)}`}>Email</a>
            </div>
          ) : null}
          {b.showAuthor && profile?.bio ? (
            <div className="site-card mt-8 flex items-start gap-4 p-5">
              {profile.avatar?.visibility === "PUBLIC" ? <img src={publicMediaUrl(profile.avatar)} alt="" className="h-14 w-14 rounded-full object-cover" /> : null}
              <div><p className="font-semibold">{profile.displayName}</p><p className="text-sm">{profile.bio}</p></div>
            </div>
          ) : null}
        </div>
      </section>
      {related.length ? (
        <section className="section-pt-sm section-pb-md" style={{ background: "var(--c-surface-alt)" }}>
          <div className="site-container">
            <h2 className="mb-8">Related posts</h2>
            <div className="site-grid">{related.map((p) => <PostCard key={p.id} post={p} options={{ showAuthor: b.showAuthor, showCategories: b.showCategories, showDate: b.showDate, showReadingTime: b.showReadingTime, cardStyle: b.cardStyle, imageAspect: b.imageAspect }} />)}</div>
          </div>
        </section>
      ) : null}
    </article>
  );
}
