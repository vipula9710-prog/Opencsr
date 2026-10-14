# Third-party licences

OpenCSR is Apache-2.0. A licence review of production dependencies (`npx license-checker --production --summary`) found: MIT, Apache-2.0, ISC, BSD-2/3-Clause, 0BSD, MIT-0, Zlib, OFL-1.1 (fonts), CC-BY-4.0 (`caniuse-lite` browser data) and LGPL-3.0-or-later (`@img/sharp-libvips-*`, an optional native image library pulled in by Next.js, dynamically linked and unmodified). All are compatible with distributing OpenCSR under Apache-2.0. Re-run the check before each release.

## Bundled assets

| Asset | Licence |
| --- | --- |
| Fonts via `@fontsource/*`: Inter, Poppins, Open Sans, Lora, Merriweather, Source Serif 4, Noto Sans Devanagari | SIL Open Font License 1.1 |
| Icons: Lucide (`lucide-react`) | ISC |
| OpenCSR mark and the fictional GreenFuture Foundation logo (`public/demo/*.svg`) | Original artwork, Apache-2.0 with this project |
| Demo images | Generated procedurally at seed time (`scripts/lib/placeholder.ts`); no photographs are bundled |

No external fonts, CDNs or tracking scripts are loaded by the application.
