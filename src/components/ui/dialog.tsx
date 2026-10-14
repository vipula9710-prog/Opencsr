"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";

/** Accessible modal built on the native <dialog> element. */
export function Dialog({
  trigger,
  title,
  children,
  triggerVariant = "outline",
  triggerSize = "md",
  wide,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className={buttonClass(triggerVariant, triggerSize)} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        onClose={close}
        aria-labelledby={title}
        className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-xl p-0 shadow-xl backdrop:bg-black/40`}
      >
        {open ? (
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 id={title} className="text-base font-semibold text-gray-900">
                {title}
              </h2>
              <button type="button" onClick={close} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{typeof children === "function" ? children(close) : children}</div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
