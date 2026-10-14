import type { OrgContext } from "@/server/context";
import { listProgrammes } from "@/server/services/projects";
import { listFocusAreas } from "@/server/services/organisations";
import { partnerOptions } from "@/server/services/partners";
import { listAssignableUsers } from "@/server/services/users";

export async function projectFormOptions(ctx: OrgContext) {
  const [programmes, focusAreas, partners, users] = await Promise.all([listProgrammes(ctx), listFocusAreas(ctx), partnerOptions(ctx), listAssignableUsers(ctx)]);
  return { programmes, focusAreas, partners, users };
}
