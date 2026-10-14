import { ShieldAlert } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold text-gray-900">You don&apos;t have access to this page</h1>
      <p className="mt-2 text-sm text-gray-600">Your role in this organisation does not include the permission required. Ask an organisation administrator if you need access.</p>
      <LinkButton href="/admin" className="mt-5">Back to dashboard</LinkButton>
    </div>
  );
}
