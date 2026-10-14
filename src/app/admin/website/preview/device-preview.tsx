"use client";

import { useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

const DEVICES = [
  { key: "desktop", label: "Desktop", width: 1280, height: 800, icon: Monitor },
  { key: "tablet", label: "Tablet", width: 768, height: 1024, icon: Tablet },
  { key: "mobile", label: "Mobile", width: 390, height: 844, icon: Smartphone },
] as const;

export function DevicePreview({ paths }: { paths: { label: string; path: string }[] }) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[0]);
  const [path, setPath] = useState(paths[0]?.path ?? "/");
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Page
          <select value={path} onChange={(e) => setPath(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-2 text-sm">
            {paths.map((p) => <option key={p.path} value={p.path}>{p.label} ({p.path})</option>)}
          </select>
        </label>
        <div role="group" aria-label="Device" className="flex gap-1">
          {DEVICES.map((d) => (
            <button key={d.key} type="button" aria-pressed={device.key === d.key} onClick={() => setDevice(d)} className={cn("flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm", device.key === d.key ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200")}>
              <d.icon className="h-4 w-4" aria-hidden /> {d.label} <span className="text-xs opacity-70">{d.width}px</span>
            </button>
          ))}
        </div>
        <a href={`/api/preview?path=${encodeURIComponent(path)}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">Open in new tab</a>
      </div>
      <div className="overflow-auto rounded-xl bg-gray-200 p-4">
        <iframe
          key={`${device.key}-${path}`}
          title={`Draft preview of ${path} on ${device.label}`}
          src={`/api/preview?path=${encodeURIComponent(path)}`}
          style={{ width: device.width, height: device.height }}
          className="mx-auto block max-w-none rounded-lg bg-white shadow-xl"
        />
      </div>
    </div>
  );
}
