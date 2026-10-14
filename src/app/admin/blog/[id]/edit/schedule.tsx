"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { postStatusAction } from "../../actions";

export function ScheduleForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(postStatusAction, {});
  const [tz, setTz] = useState("0");
  const router = useRouter();
  useEffect(() => setTz(String(new Date().getTimezoneOffset())), []);
  useEffect(() => {
    if (state.ok) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nonce]);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value="schedule" />
      <input type="hidden" name="tzOffset" value={tz} />
      <div>
        <label htmlFor="scheduledFor" className="block text-sm font-medium text-gray-800">Schedule for</label>
        <input id="scheduledFor" name="scheduledFor" type="datetime-local" required className="h-10 rounded-lg border border-gray-300 px-3 text-sm" />
      </div>
      <button type="submit" disabled={pending} className={buttonClass("outline")}>Schedule</button>
      {state.error ? <p role="alert" className="w-full text-xs font-medium text-red-700">{state.error}</p> : null}
      {state.ok ? <p role="status" className="w-full text-xs font-medium text-green-700">Scheduled. It will be published automatically.</p> : null}
    </form>
  );
}
