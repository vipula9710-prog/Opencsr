"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#9ca3af",
  PLANNED: "#3b82f6",
  ACTIVE: "#176b45",
  ON_HOLD: "#d97706",
  COMPLETED: "#7c3aed",
};

export function ProjectStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: d.status.replace("_", " ").toLowerCase() }));
  return (
    <div className="h-56" role="img" aria-label={`Projects by status: ${rows.map((r) => `${r.label} ${r.count}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" name="Projects" radius={[4, 4, 0, 0]}>
            {rows.map((r) => (
              <Cell key={r.status} fill={STATUS_COLORS[r.status] ?? "#176b45"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BudgetChart({ data, currency }: { data: { name: string; allocated: number; committed: number; utilised: number }[]; currency: string }) {
  const fmt = (v: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  return (
    <div className="h-64" role="img" aria-label="Budget allocation, commitments and utilisation by project">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number) => `${currency} ${v.toLocaleString("en-IN")}`} />
          <Legend />
          <Bar dataKey="allocated" name="Allocated" fill="#103b2b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="committed" name="Committed" fill="#c6a15b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="utilised" name="Utilised" fill="#23885a" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MeasurementChart({ data, target, baseline, unit }: { data: { period: string; value: number; verified: boolean }[]; target: number | null; baseline: number | null; unit: string }) {
  return (
    <div className="h-64" role="img" aria-label={`Measurements over time in ${unit}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number) => `${v} ${unit}`} />
          <Legend />
          {target !== null ? <ReferenceLine y={target} stroke="#c6a15b" strokeDasharray="6 4" label={{ value: "Target", fontSize: 11, position: "insideTopRight" }} /> : null}
          {baseline !== null ? <ReferenceLine y={baseline} stroke="#9ca3af" strokeDasharray="2 4" label={{ value: "Baseline", fontSize: 11, position: "insideBottomRight" }} /> : null}
          <Line type="monotone" dataKey="value" name={`Actual (${unit})`} stroke="#176b45" strokeWidth={2} dot={(p: { cx?: number; cy?: number; payload?: { verified: boolean }; index?: number }) => (
            <circle key={p.index} cx={p.cx} cy={p.cy} r={5} fill={p.payload?.verified ? "#176b45" : "#fff"} stroke="#176b45" strokeWidth={2} />
          )} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number | null; label: string }) {
  const v = value === null ? 0 : Math.min(100, value);
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={value ?? undefined} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
