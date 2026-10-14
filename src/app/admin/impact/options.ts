import type { OrgContext } from "@/server/context";
import { listProgrammes, projectOptions } from "@/server/services/projects";
import { listAssignableUsers } from "@/server/services/users";

export async function indicatorOptions(ctx: OrgContext) {
  const [projects, programmes, users] = await Promise.all([projectOptions(ctx), listProgrammes(ctx), listAssignableUsers(ctx)]);
  return { projects: projects.map((p) => ({ id: p.id, name: p.title })), programmes: programmes.map((p) => ({ id: p.id, name: p.name })), users };
}
