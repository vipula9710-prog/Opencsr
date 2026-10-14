import { CheckCircle2, Circle, Clock, PauseCircle, XCircle, AlertTriangle, Archive, FileEdit, Send, Eye } from "lucide-react";
import type { ReactNode } from "react";
import { cn, humanize } from "@/lib/utils";

type Tone = "gray" | "green" | "blue" | "amber" | "red" | "purple";

const tones: Record<Tone, string> = {
  gray: "bg-gray-100 text-gray-800 ring-gray-200",
  green: "bg-green-50 text-green-800 ring-green-200",
  blue: "bg-blue-50 text-blue-800 ring-blue-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  purple: "bg-purple-50 text-purple-800 ring-purple-200",
};

export function Badge({ tone = "gray", children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const STATUS: Record<string, { tone: Tone; icon: typeof Circle }> = {
  DRAFT: { tone: "gray", icon: FileEdit },
  PLANNED: { tone: "blue", icon: Clock },
  ACTIVE: { tone: "green", icon: CheckCircle2 },
  ON_HOLD: { tone: "amber", icon: PauseCircle },
  COMPLETED: { tone: "purple", icon: CheckCircle2 },
  ARCHIVED: { tone: "gray", icon: Archive },
  INACTIVE: { tone: "gray", icon: PauseCircle },
  NOT_STARTED: { tone: "gray", icon: Circle },
  INFORMATION_SUPPLIED: { tone: "blue", icon: FileEdit },
  DOCUMENTS_UPLOADED: { tone: "blue", icon: FileEdit },
  PENDING_REVIEW: { tone: "amber", icon: Clock },
  VERIFIED: { tone: "green", icon: CheckCircle2 },
  REJECTED: { tone: "red", icon: XCircle },
  EXPIRED: { tone: "red", icon: AlertTriangle },
  UNVERIFIED: { tone: "gray", icon: Circle },
  UNDER_REVIEW: { tone: "amber", icon: Clock },
  TODO: { tone: "gray", icon: Circle },
  IN_PROGRESS: { tone: "blue", icon: Clock },
  BLOCKED: { tone: "red", icon: AlertTriangle },
  DONE: { tone: "green", icon: CheckCircle2 },
  CANCELLED: { tone: "gray", icon: XCircle },
  PENDING: { tone: "amber", icon: Clock },
  MISSED: { tone: "red", icon: AlertTriangle },
  COMMITTED: { tone: "blue", icon: Clock },
  INCURRED: { tone: "green", icon: CheckCircle2 },
  SCHEDULED: { tone: "blue", icon: Clock },
  DISBURSED: { tone: "green", icon: CheckCircle2 },
  SUBMITTED: { tone: "amber", icon: Send },
  APPROVED: { tone: "green", icon: CheckCircle2 },
  CLOSED: { tone: "gray", icon: Archive },
  PUBLISHED: { tone: "green", icon: Eye },
  IN_REVIEW: { tone: "amber", icon: Clock },
  NEW: { tone: "blue", icon: Circle },
  PUBLIC: { tone: "green", icon: Eye },
  INTERNAL: { tone: "blue", icon: Circle },
  CONFIDENTIAL: { tone: "red", icon: AlertTriangle },
  PRIVATE: { tone: "amber", icon: AlertTriangle },
  LOW: { tone: "gray", icon: Circle },
  MEDIUM: { tone: "blue", icon: Circle },
  HIGH: { tone: "amber", icon: AlertTriangle },
  URGENT: { tone: "red", icon: AlertTriangle },
};

/** Status badge that always shows an icon and text (never colour alone). */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STATUS[status] ?? { tone: "gray" as Tone, icon: Circle };
  const Icon = s.icon;
  return (
    <Badge tone={s.tone} icon={<Icon className="h-3 w-3" aria-hidden />}>
      {label ?? humanize(status)}
    </Badge>
  );
}
