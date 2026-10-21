"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import type { ActionState } from "@/components/ui/form";
import type { ImportReport } from "@/server/services/wordpress-import";
import { importWordPressAction } from "./actions";

export function WordPressImportForm({ canPublish, canUploadMedia }: { canPublish: boolean; canUploadMedia: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(importWordPressAction, {});
  const report = state.ok ? (state.data as ImportReport) : null;
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        {state.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {state.error}
          </p>
        ) : null}
        <div className="space-y-1">
          <label htmlFor="wxr-file" className="block text-sm font-medium text-gray-800">WordPress export file (.xml)</label>
          <input id="wxr-file" name="file" type="file" accept=".xml,text/xml,application/xml" required className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800" />
          <p className="text-xs text-gray-500">Maximum 25 MB. For larger sites, export by date range or category and import each file.</p>
        </div>
        {canUploadMedia ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="importImages" defaultChecked className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-brand-600" />
            <span>
              <span className="font-medium text-gray-800">Copy images into the media library</span>
              <span className="block text-xs text-gray-500">Downloads featured images and images inside posts from your WordPress site (up to 300), so they keep working if the old site is switched off. The WordPress site must be publicly reachable.</span>
            </span>
          </label>
        ) : null}
        {canPublish ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="asDrafts" className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-brand-600" />
            <span>
              <span className="font-medium text-gray-800">Import everything as drafts</span>
              <span className="block text-xs text-gray-500">Otherwise published posts are published immediately with their original dates, and scheduled posts stay scheduled.</span>
            </span>
          </label>
        ) : (
          <p className="text-xs text-gray-600">Your role cannot publish, so all posts will be imported as drafts for an editor to review.</p>
        )}
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          {pending ? "Importing… this can take a few minutes" : "Import posts"}
        </button>
      </form>

      {report ? (
        <section role="status" className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-950">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" aria-hidden /> Import finished{report.siteTitle ? ` — ${report.siteTitle}` : ""}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>{report.imported} of {report.found} posts imported ({report.published} published, {report.scheduled} scheduled, {report.drafts} drafts)</li>
            <li>{report.images.imported} images copied to the media library{report.images.failed.length ? `, ${report.images.failed.length} could not be downloaded (they still link to the old site)` : ""}{report.images.skippedOverLimit ? `, ${report.images.skippedOverLimit} skipped over the 300-image limit` : ""}</li>
            {report.otherItems ? <li>{report.otherItems} non-post items (pages, menus, etc.) were ignored</li> : null}
            {report.publishingDowngraded ? <li>All posts were imported as drafts because your role cannot publish.</li> : null}
          </ul>
          {report.skipped.length ? (
            <details>
              <summary className="cursor-pointer font-medium">{report.skipped.length} posts skipped</summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">{report.skipped.map((s, i) => <li key={i}><strong>{s.title}</strong> — {s.reason}</li>)}</ul>
            </details>
          ) : null}
          {report.images.failed.length ? (
            <details>
              <summary className="cursor-pointer font-medium">Images that could not be copied</summary>
              <ul className="mt-2 list-disc space-y-0.5 break-all pl-5">{report.images.failed.slice(0, 50).map((f, i) => <li key={i}>{f.url} — {f.reason}</li>)}</ul>
            </details>
          ) : null}
          <Link href="/admin/blog" className="inline-block font-medium text-brand-800 underline">Review imported posts</Link>
        </section>
      ) : null}
    </div>
  );
}
