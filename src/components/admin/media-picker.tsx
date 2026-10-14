"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Search, Upload, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export type PickedMedia = { id: string; url: string; alt: string; filename: string; mimeType: string };

type Item = PickedMedia & { width: number | null; height: number | null; visibility: string };

/** Dialog for choosing (or uploading) a public image from the organisation's media library. */
export function MediaPickerDialog({ open, onClose, onPick, imagesOnly = true }: { open: boolean; onClose: () => void; onPick: (m: PickedMedia) => void; imagesOnly?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/media?${new URLSearchParams({ kind: imagesOnly ? "image" : "", q, visibility: "PUBLIC" })}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not load media");
      setItems((await res.json()).items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, imagesOnly]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
      void load();
    } else if (d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("visibility", "PUBLIC");
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      onPick(body.item);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-label="Media library" className="m-auto w-[calc(100%-2rem)] max-w-4xl rounded-xl p-0 shadow-xl backdrop:bg-black/40">
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-base font-semibold">Choose from media library</h2>
            <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
            <form
              className="relative flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or alt text" aria-label="Search media" className="h-9 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm" />
            </form>
            <label className={buttonClass("primary", "sm", "cursor-pointer")}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
              <input type="file" accept={imagesOnly ? ".jpg,.jpeg,.png,.gif,.webp,.ico" : undefined} className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          {error ? <p role="alert" className="mx-5 mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-600">No public images yet. Upload one to get started.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {items.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(m);
                        onClose();
                      }}
                      className="group block w-full overflow-hidden rounded-lg border border-gray-200 text-left hover:border-brand-600 focus-visible:border-brand-600"
                    >
                      {m.mimeType.startsWith("image/") ? (
                        <img src={m.url} alt={m.alt} className="aspect-square w-full bg-gray-100 object-cover" loading="lazy" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center bg-gray-100"><ImageIcon className="h-8 w-8 text-gray-400" /></div>
                      )}
                      <span className="block truncate px-2 py-1 text-xs text-gray-700">{m.filename}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

/** Form control storing a media asset ID in a hidden input, with preview. */
export function MediaField({ name, label, initial, hint }: { name: string; label: string; initial?: { id: string; url: string; alt?: string | null } | null; hint?: string }) {
  const [value, setValue] = useState(initial ?? null);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium text-gray-800">{label}</span>
      <input type="hidden" name={name} value={value?.id ?? ""} />
      <div className="flex items-center gap-3">
        {value ? <img src={value.url} alt={value.alt ?? ""} className="h-16 w-24 rounded-md border border-gray-200 object-cover" /> : <div className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-400"><ImageIcon className="h-6 w-6" /></div>}
        <div className="flex gap-2">
          <button type="button" className={buttonClass("outline", "sm")} onClick={() => setOpen(true)}>
            {value ? "Change" : "Choose image"}
          </button>
          {value ? (
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setValue(null)}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      <MediaPickerDialog open={open} onClose={() => setOpen(false)} onPick={(m) => setValue({ id: m.id, url: m.url, alt: m.alt })} />
    </div>
  );
}
