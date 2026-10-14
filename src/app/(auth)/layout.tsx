import { OpenCsrMark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-50 px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <OpenCsrMark className="h-10 w-10" />
        <span className="text-2xl font-semibold text-brand-800">OpenCSR</span>
      </div>
      {children}
      <p className="mt-8 text-xs text-gray-500">Free and open-source CSR management · Apache License 2.0</p>
    </div>
  );
}
