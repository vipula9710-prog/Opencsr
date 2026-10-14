import { requireUser } from "@/server/auth/session";

export const metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="mx-auto max-w-4xl bg-white p-8 print:p-0">{children}</div>;
}
