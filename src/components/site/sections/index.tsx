import type { SectionData } from "@/lib/site/section-data";
import { sectionStyleSchema, type SectionInstance } from "@/lib/site/sections";
import type { ButtonRef, ImageRef } from "@/lib/site/links";
import type { ThemeTokens } from "@/lib/theme/tokens";
import { formatDate } from "@/lib/utils";
import { SectionWrapper } from "../section-wrapper";
import { RichText, SectionHeading, SiteButton, SiteImage } from "../primitives";
import { PostCard, ProjectCard } from "../cards";
import { SiteIcon } from "../icons";
import { ContactForm } from "../contact-form";

type P = Record<string, unknown>;
type Ctx = { data: SectionData; tokens: ThemeTokens; first: boolean };

const s = (v: unknown) => (typeof v === "string" ? v : "");
const b = (v: unknown) => v === true;
const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const btn = (v: unknown) => (v && typeof v === "object" ? (v as ButtonRef) : null);
const img = (v: unknown) => (v && typeof v === "object" ? (v as ImageRef) : null);
const arr = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
const cols = (v: unknown) => (v === "2" || v === "3" || v === "4" ? ({ ["--cols" as string]: v } as React.CSSProperties) : undefined);

function Buttons({ p, align }: { p: P; align: string }) {
  const one = btn(p.primaryButton ?? p.button);
  const two = btn(p.secondaryButton);
  if (!one?.label && !two?.label) return null;
  return (
    <div className={`mt-8 flex flex-wrap gap-3 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
      <SiteButton button={one} />
      <SiteButton button={two} variant="secondary" />
    </div>
  );
}

function Hero({ p, align, first }: { p: P; align: string; first: boolean }) {
  const size = s(p.size) || "md";
  const H = first ? "h1" : "h2";
  return (
    <div className={`${size === "lg" ? "py-12" : size === "sm" ? "py-2" : "py-6"} ${align === "center" ? "mx-auto max-w-4xl" : "max-w-4xl"}`}>
      {s(p.eyebrow) ? <p className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--section-eyebrow, var(--c-primary))" }}>{s(p.eyebrow)}</p> : null}
      <H style={size === "lg" ? { fontSize: "clamp(2.2rem, 7cqi, calc(var(--fs-h1) * 1.2))" } : undefined}>{s(p.heading)}</H>
      {s(p.subheading) ? <p className="mt-5 text-lg opacity-90 @3xl:text-xl">{s(p.subheading)}</p> : null}
      <Buttons p={p} align={align} />
    </div>
  );
}

function HeroImage({ p, align, first }: { p: P; align: string; first: boolean }) {
  const left = s(p.imagePosition) === "left";
  const H = first ? "h1" : "h2";
  return (
    <div className="grid items-center gap-10 @3xl:grid-cols-2">
      <div className={left ? "@3xl:order-2" : ""}>
        {s(p.eyebrow) ? <p className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--section-eyebrow, var(--c-primary))" }}>{s(p.eyebrow)}</p> : null}
        <H>{s(p.heading)}</H>
        {s(p.subheading) ? <p className="mt-5 text-lg opacity-90">{s(p.subheading)}</p> : null}
        <Buttons p={p} align={align} />
      </div>
      <div className={left ? "@3xl:order-1" : ""}>
        {img(p.image)?.url ? <SiteImage image={img(p.image)} eager={first} /> : <div className="site-img" style={{ background: "var(--c-surface-alt)" }} aria-hidden />}
      </div>
    </div>
  );
}

function HeroBackground({ p, align, first }: { p: P; align: string; first: boolean }) {
  const image = img(p.image);
  const overlay = Math.min(90, Math.max(0, n(p.overlay, 55))) / 100;
  const height = s(p.height) === "screen" ? "min-h-[85vh]" : s(p.height) === "md" ? "min-h-[380px]" : "min-h-[540px]";
  const H = first ? "h1" : "h2";
  return (
    <div className={`relative flex items-center overflow-hidden ${height}`} style={{ background: "var(--c-secondary)" }}>
      {image?.url ? <SiteImage image={image} className="absolute inset-0 h-full w-full object-cover" eager={first} /> : null}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} aria-hidden />
      <div className={`site-container relative py-16 ${align === "center" ? "text-center" : ""}`} style={{ color: "#fff", ["--section-heading" as string]: "#fff", ["--section-eyebrow" as string]: "#fff" }}>
        <div className={align === "center" ? "mx-auto max-w-3xl" : "max-w-3xl"}>
          {s(p.eyebrow) ? <p className="mb-3 text-sm font-semibold uppercase tracking-wider">{s(p.eyebrow)}</p> : null}
          <H>{s(p.heading)}</H>
          {s(p.subheading) ? <p className="mt-5 text-lg opacity-95">{s(p.subheading)}</p> : null}
          <Buttons p={p} align={align} />
        </div>
      </div>
    </div>
  );
}

function SplitText({ p, align, imageFirstDefault }: { p: P; align: string; imageFirstDefault: boolean }) {
  const image = img(p.image);
  const left = s(p.imagePosition) ? s(p.imagePosition) === "left" : imageFirstDefault;
  const text = (
    <div>
      <SectionHeading eyebrow={s(p.eyebrow)} heading={s(p.heading)} align={align} />
      <div className="-mt-6"><RichText html={s(p.body)} /></div>
      <Buttons p={p} align={align} />
    </div>
  );
  if (!image?.url) return <div className="max-w-3xl">{text}</div>;
  return (
    <div className="grid items-center gap-10 @3xl:grid-cols-2">
      <div className={left ? "@3xl:order-2" : ""}>{text}</div>
      <div className={left ? "@3xl:order-1" : ""}><SiteImage image={image} /></div>
    </div>
  );
}

function FocusAreas({ p, data, align }: { p: P; data: SectionData; align: string }) {
  const items =
    s(p.source) === "custom"
      ? arr<P>(p.items).map((i) => ({ title: s(i.title), description: s(i.description), icon: s(i.icon), link: btn(i.link) }))
      : data.focusAreas.map((f) => ({ title: f.name, description: f.description ?? "", icon: f.icon ?? "leaf", link: null as ButtonRef | null }));
  return (
    <>
      <SectionHeading eyebrow={s(p.eyebrow)} heading={s(p.heading)} intro={s(p.intro)} align={align} />
      {items.length === 0 ? (
        <p className="opacity-80">{data.preview ? "No focus areas yet — add them under CSR Programmes → Focus areas, or switch this section to custom items." : null}</p>
      ) : (
        <div className="site-grid" style={cols(p.columns)}>
          {items.map((i, idx) => (
            <div key={idx} className="site-card flex flex-col gap-3 p-6 text-left">
              <span className="site-icon"><SiteIcon name={i.icon} className="h-6 w-6" /></span>
              <h3 className="text-xl">{i.title}</h3>
              {i.description ? <p className="text-sm">{i.description}</p> : null}
              {i.link?.label ? <a href={i.link.href} className="site-link mt-auto text-sm font-semibold">{i.link.label} →</a> : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Projects({ p, data, align, grid }: { p: P; data: SectionData; align: string; grid: boolean }) {
  const count = n(p.count, grid ? 9 : 3);
  let projects = data.projects;
  if (!grid && s(p.mode) === "manual") {
    const ids = arr<string>(p.projectIds);
    projects = ids.map((id) => data.projects.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  }
  projects = projects.slice(0, count);
  return (
    <>
      <SectionHeading eyebrow={s(p.eyebrow)} heading={s(p.heading)} intro={s(p.intro)} align={align} />
      {projects.length === 0 ? (
        <p className="opacity-80">{data.preview ? "No published projects yet. Mark a project as “Publish on the public website” to show it here." : "Projects will appear here soon."}</p>
      ) : (
        <div className="site-grid" style={grid ? cols(p.columns) : undefined}>
          {projects.map((proj) => <ProjectCard key={proj.id} project={proj} showStatus={grid ? false : b(p.showStatus)} showSummary={grid ? b(p.showSummary) : true} />)}
        </div>
      )}
      {!grid ? <Buttons p={{ button: p.button }} align={align === "left" ? "left" : "center"} /> : null}
    </>
  );
}

function ImpactMetrics({ p, data, align }: { p: P; data: SectionData; align: string }) {
  const items =
    s(p.source) === "indicators"
      ? data.indicators.map((i) => ({ value: Number(i.value).toLocaleString("en-IN"), label: `${i.name}`, description: `${i.unit} · verified, period ending ${formatDate(i.periodEnd)}` }))
      : arr<P>(p.items).map((i) => ({ value: s(i.value), label: s(i.label), description: s(i.description) }));
  return (
    <>
      <SectionHeading eyebrow={s(p.eyebrow)} heading={s(p.heading)} intro={s(p.intro)} align={align} />
      {items.length === 0 ? (
        <p className="opacity-80">{data.preview ? (s(p.source) === "indicators" ? "No public indicator has a verified measurement yet." : "Add figures in the section settings.") : null}</p>
      ) : (
        <dl className="grid gap-6 @xl:grid-cols-2 @5xl:grid-cols-4">
          {items.map((i, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              <dt className="order-2 text-base font-semibold">{i.label}</dt>
              <dd className="order-1 font-[family-name:var(--font-heading)] text-4xl font-bold @3xl:text-5xl">{i.value}</dd>
              {i.description ? <dd className="order-3 text-sm opacity-85">{i.description}</dd> : null}
            </div>
          ))}
        </dl>
      )}
      {s(p.note) ? <p className="mt-8 text-sm opacity-85">{s(p.note)}</p> : null}
      {data.isDemo && items.length ? <p className="mt-2 text-xs font-semibold opacity-90">Demo content: these figures are fictional.</p> : null}
    </>
  );
}

function LatestPosts({ p, data, align }: { p: P; data: SectionData; align: string }) {
  const posts = data.posts.slice(0, n(p.count, 3));
  const list = s(p.layout) === "list";
  return (
    <>
      <SectionHeading eyebrow={s(p.eyebrow)} heading={s(p.heading)} intro={s(p.intro)} align={align} />
      {posts.length === 0 ? (
        <p className="opacity-80">{data.preview ? "No published posts yet." : "Stories will appear here soon."}</p>
      ) : (
        <div className={list ? "grid gap-6" : "site-grid"}>
          {posts.map((post) => <PostCard key={post.id} post={post} options={{ showAuthor: true, showCategories: true, showDate: true, showReadingTime: false, cardStyle: "elevated", horizontal: list }} />)}
        </div>
      )}
      <Buttons p={{ button: p.button }} align={align === "left" ? "left" : "center"} />
    </>
  );
}

function Reports({ p, data, align }: { p: P; data: SectionData; align: string }) {
  const items = data.reports.slice(0, n(p.count, 4));
  return (
    <>
      <SectionHeading eyebrow={s(p.eyebrow)} heading={s(p.heading)} intro={s(p.intro)} align={align} />
      {items.length === 0 ? (
        <p className="opacity-80">{data.preview ? "No published reports or public approved documents yet." : "Reports will be published here."}</p>
      ) : (
        <ul className="grid gap-4 @3xl:grid-cols-2">
          {items.map((r) => (
            <li key={r.id} className="site-card flex items-center justify-between gap-4 p-5 text-left">
              <div>
                <span className="site-badge capitalize">{r.label}</span>
                <p className="mt-2 font-semibold" style={{ color: "var(--c-heading)" }}>{r.title}</p>
                {r.date ? <p className="text-xs" style={{ color: "var(--c-muted)" }}>{formatDate(r.date)}</p> : null}
              </div>
              <a href={r.href} className="site-btn site-btn-secondary shrink-0" aria-label={`Open ${r.title}`}>Open</a>
            </li>
          ))}
        </ul>
      )}
      <Buttons p={{ button: p.button }} align={align === "left" ? "left" : "center"} />
    </>
  );
}

function Gallery({ p, align, data }: { p: P; align: string; data: SectionData }) {
  const images = arr<P>(p.images).filter((i) => img(i.image)?.url);
  return (
    <>
      <SectionHeading eyebrow={s(p.eyebrow)} heading={s(p.heading)} intro={s(p.intro)} align={align} />
      {images.length === 0 ? <p className="opacity-80">{data.preview ? "Add images in the section settings." : null}</p> : (
        <ul className="site-grid" style={cols(p.columns)}>
          {images.map((i, idx) => (
            <li key={idx}>
              <figure>
                <SiteImage image={img(i.image)} />
                {s(i.caption) ? <figcaption className="mt-2 text-sm opacity-85">{s(i.caption)}</figcaption> : null}
              </figure>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Initiatives({ p, align, data }: { p: P; align: string; data: SectionData }) {
  const items = arr<P>(p.items);
  return (
    <>
      <SectionHeading eyebrow={s(p.eyebrow)} heading={s(p.heading)} intro={s(p.intro)} align={align} />
      {items.length === 0 ? <p className="opacity-80">{data.preview ? "Add initiatives in the section settings." : null}</p> : (
        <div className="site-grid" style={cols(p.columns)}>
          {items.map((i, idx) => (
            <article key={idx} className="site-card flex flex-col text-left">
              {img(i.image)?.url ? <SiteImage image={img(i.image)} className="site-img" /> : null}
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h3 className="text-xl">{s(i.title)}</h3>
                {s(i.description) ? <p className="text-sm">{s(i.description)}</p> : null}
                {btn(i.link)?.label ? <a href={btn(i.link)!.href} className="site-link mt-auto text-sm font-semibold">{btn(i.link)!.label} →</a> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function Cta({ p, align }: { p: P; align: string }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl" : "max-w-3xl"}>
      <h2>{s(p.heading)}</h2>
      {s(p.body) ? <p className="mt-4 text-lg opacity-90">{s(p.body)}</p> : null}
      <Buttons p={p} align={align} />
    </div>
  );
}

function Contact({ p, data, align }: { p: P; data: SectionData; align: string }) {
  const details = b(p.showDetails) && (data.contact.email || data.contact.phone || data.contact.address);
  return (
    <>
      <SectionHeading eyebrow={s(p.eyebrow)} heading={s(p.heading)} intro={s(p.intro)} align={align} />
      <div className={`grid gap-10 ${details && b(p.showForm) ? "@4xl:grid-cols-3" : ""}`}>
        {details ? (
          <address className="space-y-4 text-left not-italic">
            {data.contact.email ? <p><span className="block text-sm font-semibold">Email</span><a className="site-link" href={`mailto:${data.contact.email}`}>{data.contact.email}</a></p> : null}
            {data.contact.phone ? <p><span className="block text-sm font-semibold">Phone</span><a className="site-link" href={`tel:${data.contact.phone.replace(/\s/g, "")}`}>{data.contact.phone}</a></p> : null}
            {data.contact.address ? <p><span className="block text-sm font-semibold">Address</span><span className="whitespace-pre-line">{data.contact.address}</span></p> : null}
          </address>
        ) : null}
        {b(p.showForm) ? (
          <div className={details ? "@4xl:col-span-2" : "mx-auto w-full max-w-2xl"}>
            <ContactForm categories={data.enquiry.categories} token={data.enquiry.token} preview={data.preview && !data.enquiry.token} />
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Renders one validated section. Unknown types render nothing. */
export function SectionRenderer({ section, data, tokens, index, selected }: { section: SectionInstance; data: SectionData; tokens: ThemeTokens; index: number; selected?: boolean }) {
  const p = section.props;
  const style = sectionStyleSchema.parse(p.style ?? {});
  const align = style.align;
  const ctx: Ctx = { data, tokens, first: index === 0 };
  let body: React.ReactNode;
  switch (section.type) {
    case "hero":
      body = <Hero p={p} align={align} first={ctx.first} />;
      break;
    case "heroImage":
      body = <HeroImage p={p} align={align} first={ctx.first} />;
      break;
    case "heroBackground":
      return (
        <SectionWrapper style={style} tokens={tokens} id={`section-${section.id}`} sectionId={section.id} selected={selected} flush>
          <HeroBackground p={p} align={align} first={ctx.first} />
        </SectionWrapper>
      );
    case "about":
      body = <SplitText p={p} align={align} imageFirstDefault={false} />;
      break;
    case "imageText":
      body = <SplitText p={p} align={align} imageFirstDefault />;
      break;
    case "focusAreas":
      body = <FocusAreas p={p} data={data} align={align} />;
      break;
    case "featuredProjects":
      body = <Projects p={p} data={data} align={align} grid={false} />;
      break;
    case "projectGrid":
      body = <Projects p={p} data={data} align={align} grid />;
      break;
    case "impactMetrics":
      body = <ImpactMetrics p={p} data={data} align={align} />;
      break;
    case "latestPosts":
      body = <LatestPosts p={p} data={data} align={align} />;
      break;
    case "reports":
      body = <Reports p={p} data={data} align={align} />;
      break;
    case "gallery":
      body = <Gallery p={p} align={align} data={data} />;
      break;
    case "initiatives":
      body = <Initiatives p={p} align={align} data={data} />;
      break;
    case "cta":
      body = <Cta p={p} align={align} />;
      break;
    case "contact":
      body = <Contact p={p} data={data} align={align} />;
      break;
    case "richText":
      body = <RichText html={s(p.content)} />;
      break;
    default:
      return null;
  }
  return (
    <SectionWrapper style={style} tokens={tokens} id={`section-${section.id}`} sectionId={section.id} selected={selected}>
      {body}
    </SectionWrapper>
  );
}

export function SectionList({ sections, data, tokens, selectedId }: { sections: SectionInstance[]; data: SectionData; tokens: ThemeTokens; selectedId?: string | null }) {
  return (
    <>
      {sections.filter((sec) => !sec.hidden).map((sec, i) => (
        <SectionRenderer key={sec.id} section={sec} data={data} tokens={tokens} index={i} selected={selectedId === sec.id} />
      ))}
    </>
  );
}
