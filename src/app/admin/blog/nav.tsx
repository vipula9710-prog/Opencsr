import Link from "next/link";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/blog", label: "Posts" },
  { href: "/admin/blog/categories", label: "Categories" },
  { href: "/admin/blog/tags", label: "Tags" },
  { href: "/admin/blog/authors", label: "Authors" },
  { href: "/admin/blog/import", label: "Import from WordPress" },
];

export function BlogNav({ active }: { active: string }) {
  return (
    <nav aria-label="Blog sections" className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active === i.href ? "page" : undefined} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", active === i.href ? "border-brand-600 text-brand-800" : "border-transparent text-gray-600 hover:text-gray-900")}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
