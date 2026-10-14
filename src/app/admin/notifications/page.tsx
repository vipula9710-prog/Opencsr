import Link from "next/link";
import { requireOrgContext } from "@/server/auth/session";
import { listNotifications, markRead } from "@/server/services/notifications";
import { getOrgContext } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/ui/confirm-button";
import { runAction, type ActionState } from "@/server/action";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Notifications" };

async function markAllRead(_: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  return runAction(async () => {
    const ctx = await getOrgContext();
    if (ctx) await markRead(ctx, (fd.get("id") as string) || undefined);
  });
}

export default async function NotificationsPage() {
  const ctx = await requireOrgContext();
  const items = await listNotifications(ctx, { take: 100 });
  return (
    <div>
      <PageHeader title="Notifications" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Notifications" }]} actions={items.some((i) => !i.readAt) ? <ActionButton action={markAllRead} size="md">Mark all as read</ActionButton> : null} />
      {items.length === 0 ? <EmptyState title="No notifications" description="You'll be notified about assigned tasks, deadlines, reviews and publishing events." /> : (
        <Card>
          <ul className="divide-y divide-gray-100">
            {items.map((n) => (
              <li key={n.id} className={cn("flex flex-wrap items-start justify-between gap-2 px-5 py-3", !n.readAt && "bg-brand-50/50")}>
                <div>
                  <p className="text-sm font-medium">{!n.readAt ? <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" /> : null}{n.link ? <Link href={n.link} className="hover:underline">{n.title}</Link> : n.title}</p>
                  {n.body ? <p className="text-sm text-gray-600">{n.body}</p> : null}
                  <p className="text-xs text-gray-500">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.readAt ? <ActionButton action={markAllRead} fields={{ id: n.id }} variant="ghost">Mark read</ActionButton> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
