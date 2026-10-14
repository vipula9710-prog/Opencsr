import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Table({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600", className)} {...props} />;
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-top text-gray-800", className)} {...props} />;
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("hover:bg-gray-50/60", className)}>{children}</tr>;
}

/** Sortable column header that preserves other query parameters. */
export function SortTh({ label, field, params, basePath }: { label: string; field: string; params: Record<string, string | undefined>; basePath: string }) {
  const active = params.sort === field;
  const dir = active && params.dir === "asc" ? "desc" : "asc";
  const qs = new URLSearchParams(Object.entries({ ...params, sort: field, dir, page: "1" }).filter(([, v]) => v) as [string, string][]);
  const Icon = active ? (params.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Th aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={`${basePath}?${qs}`} className="inline-flex items-center gap-1 hover:text-gray-900">
        {label}
        <Icon className="h-3 w-3" aria-hidden />
      </Link>
    </Th>
  );
}
