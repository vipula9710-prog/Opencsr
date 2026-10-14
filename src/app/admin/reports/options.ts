import type { OrgContext } from "@/server/context";
import { listProgrammes, projectOptions } from "@/server/services/projects";
import { currentFyStartYear, fyLabel } from "@/server/services/organisations";

export async function reportOptions(ctx: OrgContext) {
  const [projects, programmes] = await Promise.all([projectOptions(ctx), listProgrammes(ctx)]);
  const fy = currentFyStartYear(ctx.organisation.financialYearStartMonth);
  return {
    projects: projects.map((p) => ({ value: p.id, label: p.title })),
    programmes: programmes.map((p) => ({ value: p.id, label: p.name })),
    years: [fy - 3, fy - 2, fy - 1, fy, fy + 1].map((y) => ({ value: String(y), label: fyLabel(y, ctx.organisation.financialYearStartMonth) })),
  };
}
