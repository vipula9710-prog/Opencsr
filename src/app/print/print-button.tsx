"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="no-print mb-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
      Print / save as PDF
    </button>
  );
}
