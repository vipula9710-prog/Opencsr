import type { ButtonRef, ImageRef } from "@/lib/site/links";
import { isExternalHref, isSafeHref, isSafeImageUrl } from "@/lib/site/links";

export function SiteButton({ button, variant = "primary" }: { button?: ButtonRef | null; variant?: "primary" | "secondary" }) {
  if (!button?.label || !button.href || !isSafeHref(button.href)) return null;
  const external = isExternalHref(button.href);
  return (
    <a
      href={button.href}
      className={`site-btn site-btn-${variant}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {button.label}
    </a>
  );
}

export function SiteImage({ image, className, eager }: { image?: ImageRef | null; className?: string; eager?: boolean }) {
  if (!image?.url || !isSafeImageUrl(image.url)) return null;
  return <img src={image.url} alt={image.alt ?? ""} className={className ?? "site-img"} loading={eager ? "eager" : "lazy"} decoding="async" />;
}

export function SectionHeading({ eyebrow, heading, intro, align = "left", as = "h2" }: { eyebrow?: string; heading?: string; intro?: string; align?: string; as?: "h1" | "h2" }) {
  if (!eyebrow && !heading && !intro) return null;
  const H = as;
  return (
    <div className={`mb-10 max-w-3xl ${align === "center" ? "mx-auto text-center" : align === "right" ? "ml-auto text-right" : ""}`}>
      {eyebrow ? <p className="mb-2 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--section-eyebrow, var(--c-primary))" }}>{eyebrow}</p> : null}
      {heading ? <H>{heading}</H> : null}
      {intro ? <p className="mt-4 text-lg opacity-90">{intro}</p> : null}
    </div>
  );
}

export function RichText({ html, className }: { html: string; className?: string }) {
  // Content is sanitised on the server before it is stored.
  return <div className={`rich-text ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
