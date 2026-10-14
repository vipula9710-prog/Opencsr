import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  { ignores: [".next/**", "node_modules/**", "dist-scripts/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "storage/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@next/next/no-img-element": "off",
    },
  },
  {
    // The public website uses plain anchors on purpose: links are organisation-
    // configured, pages are server-rendered per host, and the builder preview
    // intercepts anchor clicks.
    files: ["src/app/(site)/**", "src/components/site/**"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
];

export default config;
