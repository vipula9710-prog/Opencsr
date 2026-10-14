import Link from "next/link";
import { requireOrgContext } from "@/server/auth/session";
import { listBudgetPlans } from "@/server/services/finance";
import { currentFyStartYear, fyLabel } from "@/server/services/organisations";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/money";
import { createPlanAction } from "./actions";

export const metadata = { title: "Budgets & Expenditure" };

export default async function BudgetsPage() {
  const ctx = await requireOrgContext("finance.read");
  const plans = await listBudgetPlans(ctx);
  const m = ctx.organisation.financialYearStartMonth;
  const fy = currentFyStartYear(m);
  const money = (v: string) => formatMoney(v, ctx.organisation.currency, ctx.organisation.locale);
  return (
    <div>
      <PageHeader
        title="Budgets & Expenditure"
        description="Plan annual CSR budgets, allocate them to projects and track commitments, utilisation and disbursements. This module tracks CSR spending; it is not a replacement for your accounting system."
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Budgets" }]}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {plans.length === 0 ? (
            <EmptyState title="No budget plans" description="Create a plan for a financial year to start allocating funds." />
          ) : (
            <Table caption="Budget plans">
              <thead><tr><Th>Plan</Th><Th>Financial year</Th><Th>Total</Th><Th>Allocated</Th><Th>Utilised</Th><Th>Status</Th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {plans.map((p) => (
                  <Tr key={p.id}>
                    <Td><Link href={`/admin/budgets/${p.id}`} className="font-medium hover:underline">{p.title}</Link></Td>
                    <Td>{p.fyLabel}</Td>
                    <Td>{money(p.totalAmount)}</Td>
                    <Td>{money(p.summary.allocated)} <span className="text-xs text-gray-500">({p.summary.allocationPct}%)</span></Td>
                    <Td>{money(p.summary.utilised)} <span className="text-xs text-gray-500">({p.summary.utilisationPct}%)</span></Td>
                    <Td><StatusBadge status={p.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
          <Card className="mt-6">
            <CardHeader title="How amounts are defined" />
            <CardBody>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="font-medium">Allocated</dt><dd className="text-gray-600">Funds assigned from an annual plan to a project or programme.</dd></div>
                <div><dt className="font-medium">Committed</dt><dd className="text-gray-600">Expenditure promised (e.g. a signed purchase order) but not yet incurred.</dd></div>
                <div><dt className="font-medium">Utilised</dt><dd className="text-gray-600">Expenditure actually incurred. Utilisation % = utilised ÷ allocated.</dd></div>
                <div><dt className="font-medium">Disbursed</dt><dd className="text-gray-600">Funds transferred to a partner. Shown separately and never added to utilisation, to avoid double counting.</dd></div>
                <div><dt className="font-medium">Remaining</dt><dd className="text-gray-600">Allocated − committed − utilised.</dd></div>
              </dl>
            </CardBody>
          </Card>
        </div>
        {ctx.permissions.has("finance.write") ? (
          <Card>
            <CardHeader title="New budget plan" />
            <CardBody>
              <ActionForm action={createPlanAction} className="space-y-3">
                <TextField label="Title" name="title" defaultValue={`CSR budget ${fyLabel(fy, m)}`} required />
                <SelectField label="Financial year" name="fyStartYear" defaultValue={String(fy)} options={[fy - 2, fy - 1, fy, fy + 1, fy + 2].map((y) => ({ value: String(y), label: fyLabel(y, m) }))} />
                <TextField label={`Total budget (${ctx.organisation.currency})`} name="totalAmount" inputMode="decimal" placeholder="0.00" required />
                <TextAreaField label="Notes" name="notes" rows={2} />
                <SubmitButton size="sm">Create plan</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
