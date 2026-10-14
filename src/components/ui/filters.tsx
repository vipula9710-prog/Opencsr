import { Search } from "lucide-react";
import type { ReactNode } from "react";

/** GET-based filter bar; works without JavaScript and keeps URLs shareable. */
export function FilterBar({ q, children, placeholder = "Search…", hidden = {} }: { q?: string; children?: ReactNode; placeholder?: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-2" role="search">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="relative min-w-[14rem] flex-1">
        <label htmlFor="filter-q" className="sr-only">
          Search
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          id="filter-q"
          type="search"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="block h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      {children}
      <button type="submit" className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800">
        Apply
      </button>
    </form>
  );
}

export function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="sr-only">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={value ?? ""} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-brand-600 focus:outline-none">
        <option value="">{label}: all</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
