import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({ page, pageCount, total, params, basePath }: { page: number; pageCount: number; total: number; params: Record<string, string | undefined>; basePath: string }) {
  if (pageCount <= 1) return <p className="mt-3 text-sm text-gray-600">{total} {total === 1 ? "record" : "records"}</p>;
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${qs}`;
  };
  const link = "rounded-lg border px-3 py-1.5 text-sm";
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-600">
        Page {page} of {pageCount} · {total} records
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={cn(link, "border-gray-300 bg-white hover:bg-gray-50")} href={href(page - 1)} rel="prev">
            Previous
          </Link>
        ) : (
          <span className={cn(link, "border-gray-200 text-gray-400")} aria-disabled>
            Previous
          </span>
        )}
        {page < pageCount ? (
          <Link className={cn(link, "border-gray-300 bg-white hover:bg-gray-50")} href={href(page + 1)} rel="next">
            Next
          </Link>
        ) : (
          <span className={cn(link, "border-gray-200 text-gray-400")} aria-disabled>
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
