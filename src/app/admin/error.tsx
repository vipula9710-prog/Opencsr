"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-red-600" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-600">The page could not be loaded. No changes were saved.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
      <Button className="mt-5" onClick={reset}>Try again</Button>
    </div>
  );
}
