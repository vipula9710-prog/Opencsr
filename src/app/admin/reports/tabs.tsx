import Link from "next/link";
import { cn } from "@/lib/utils";

export function ReportsTabs({ active }: { active: "reports" | "documents" }) {
  return (
    <nav aria-label="Reports and documents" className="mb-4 flex gap-1 border-b border-gray-200">
      {(["reports", "documents"] as const).map((t) => (
        <Link key={t} href={`/admin/${t}`} aria-current={active === t ? "page" : undefined} className={cn("border-b-2 px-3 py-2 text-sm font-medium", active === t ? "border-brand-600 text-brand-800" : "border-transparent text-gray-600 hover:text-gray-900")}>
          {t === "reports" ? "Generated reports" : "Documents"}
        </Link>
      ))}
    </nav>
  );
}
