import { LinkButton } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="text-xl font-semibold text-gray-900">Not found</h1>
      <p className="mt-2 text-sm text-gray-600">This record does not exist or belongs to another organisation.</p>
      <LinkButton href="/admin" className="mt-5">Back to dashboard</LinkButton>
    </div>
  );
}
