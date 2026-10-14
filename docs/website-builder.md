# Website builder

Every organisation designs and publishes its own public website from **Website Builder** in the dashboard — no code changes.

## Areas

| Route | Purpose |
| --- | --- |
| `/admin/website` | Overview, live version, links to every area |
| `/admin/website/homepage`, `/admin/website/pages/[id]` | Three-panel visual editor for a page |
| `/admin/website/pages` | Create, publish, unpublish, archive/restore pages; revision history |
| `/admin/website/theme` | Colour tokens with preset palettes, HEX input, contrast warnings, reset |
| `/admin/website/typography` | Heading/body/Devanagari fonts, H1–H6 sizes, weights, line height, spacing, links, buttons |
| `/admin/website/header-footer` | Identity (name, tagline, logo, favicon), header layout & CTA, footer columns, contact, social and legal links, SEO defaults, system page headings |
| `/admin/website/navigation` | Header menu (with one level of dropdowns) and footer menu |
| `/admin/website/blog-layout` | Grid/list/featured layouts, columns, cards, metadata, sidebar, article width & size |
| `/admin/website/templates` | Corporate Green, Professional Blue, Minimal White, Earth & Sustainability, Premium Charcoal (preview before applying; previous theme backed up) |
| `/admin/website/preview` | Real draft site in desktop/tablet/mobile frames |
| `/admin/website/publish` | Publish, discard, version history, restore and rollback |

## The editor

- **Left panel** — panel switcher, page picker, section list (select, drag-and-drop or arrow-button reordering, hide/show, duplicate, delete) and *Add section*.
- **Centre panel** — live preview rendered by the same components as the public site, using CSS container queries so the desktop, tablet and mobile buttons show true responsive layouts. Click a section to select it.
- **Right panel** — content fields and *Design & layout* (background, custom colours, spacing, alignment, width, responsive visibility, anchor ID) for the selected section, or the editor for the active panel.

Changes autosave to the **draft** after a short pause; the top bar shows *Saving…*, *Draft saved* or the server's validation error. Leaving the page with unsaved changes triggers a browser warning.

## Section types

Hero banner, hero with image, hero with background image, introduction/about, CSR focus areas, featured projects, project grid, impact metrics, latest blog posts, reports & documents, image gallery, community initiatives, call to action, contact section, rich text, image & text.

Each type is defined declaratively in `src/lib/site/sections.ts`; its validation schema, editor form and defaults are derived from the field list. To add a type, add a definition there and a renderer case in `src/components/site/sections/index.tsx`.

## Drafts, publishing and safety

- Visitors only ever see the **published** version. Drafts are visible in previews only to signed-in users with `website.edit` in that organisation (Next.js draft mode plus a server-side permission check on every request).
- **Publish** validates the theme, site settings and every live page, creates an immutable `ThemeVersion` and `PageRevision`s in one transaction, and only then reports success and invalidates the public cache.
- **Discard** resets all drafts to the live version. **Restore** copies an older version into the draft; **Roll back & publish** makes it live at once. Applying a template saves a backup version first.
- Pages cannot use reserved addresses (`/admin`, `/api`, `/blog`, `/projects`, `/reports`, `/contact`, …).
- No arbitrary CSS, JavaScript or HTML: colours must be `#RRGGBB`, fonts come from a fixed list of bundled OFL fonts, layout options are enums, links are restricted to safe schemes, and rich text is sanitised on the server.
- Organisations can require approval for publishing (Organisation Settings → Approval steps).
