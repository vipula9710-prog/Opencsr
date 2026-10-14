import sanitizeHtml from "sanitize-html";

// Allow-list for rich text produced by the TipTap editor. Everything else —
// scripts, event handlers, iframes, styles, unknown protocols — is removed.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote",
    "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "img", "hr",
    "table", "thead", "tbody", "tr", "th", "td", "figure", "figcaption", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    "*": [],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href);
      return {
        tagName,
        attribs: {
          ...attribs,
          ...(external || attribs.target === "_blank" ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {}),
        },
      };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
  // Relative image sources (e.g. /media/...) are allowed by allowing paths.
  allowedSchemesAppliedToAttributes: ["href", "src"],
};

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  // Relative URLs such as "/media/abc/file.jpg" pass through sanitize-html unchanged.
  return sanitizeHtml(html, OPTIONS).trim();
}

export function sanitizePlain(text: string | null | undefined): string {
  if (!text) return "";
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }).trim();
}
