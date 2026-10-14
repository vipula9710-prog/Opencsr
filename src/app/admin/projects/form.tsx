import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { MediaField } from "@/components/admin/media-picker";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { humanize, toDateInput } from "@/lib/utils";
import { PROJECT_STATUSES } from "@/server/services/projects";
import { createProjectAction, updateProjectAction } from "./actions";

type Option = { id: string; name: string };
export type ProjectFormData = {
  id: string; title: string; slug: string; summary: string | null; description: string | null; objectives: string | null;
  programmeId: string | null; focusAreaId: string | null; partnerId: string | null; ownerId: string | null; location: string | null;
  startDate: Date | null; endDate: Date | null; status: string; risks: string | null; dependencies: string | null; notes: string | null;
  isPublic: boolean; publicSummary: string | null; coverImage: { id: string; filename: string; altText: string | null } | null; memberIds: string[];
};

export function ProjectForm({ project, programmes, focusAreas, partners, users, defaults }: { project?: ProjectFormData; programmes: Option[]; focusAreas: Option[]; partners: Option[]; users: Option[]; defaults?: { programmeId?: string } }) {
  return (
    <ActionForm action={project ? updateProjectAction : createProjectAction} className="space-y-6">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <Card>
        <CardHeader title="Basics" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Title" name="title" defaultValue={project?.title} required />
            <TextField label="Slug" name="slug" defaultValue={project?.slug} hint="Used in the public URL. Leave empty to generate." />
          </div>
          <TextAreaField label="Summary" name="summary" defaultValue={project?.summary ?? ""} rows={2} hint="One or two sentences (internal)." />
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-800">Description</span>
            <RichTextEditor name="description" label="Description" initialHtml={project?.description} />
          </div>
          <TextAreaField label="Objectives" name="objectives" defaultValue={project?.objectives ?? ""} rows={3} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Classification & people" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Programme" name="programmeId" defaultValue={project?.programmeId ?? defaults?.programmeId ?? ""} placeholder="None" options={programmes.map((p) => ({ value: p.id, label: p.name }))} />
            <SelectField label="Focus area" name="focusAreaId" defaultValue={project?.focusAreaId ?? ""} placeholder="None" options={focusAreas.map((p) => ({ value: p.id, label: p.name }))} />
            <SelectField label="Implementing partner" name="partnerId" defaultValue={project?.partnerId ?? ""} placeholder="None" options={partners.map((p) => ({ value: p.id, label: p.name }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Project owner" name="ownerId" defaultValue={project?.ownerId ?? ""} placeholder="Unassigned" options={users.map((u) => ({ value: u.id, label: u.name }))} />
            <SelectField label="Status" name="status" defaultValue={project?.status ?? "DRAFT"} options={PROJECT_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => ({ value: s, label: humanize(s) }))} />
            <TextField label="Location" name="location" defaultValue={project?.location ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Start date" name="startDate" type="date" defaultValue={toDateInput(project?.startDate)} />
            <TextField label="End date" name="endDate" type="date" defaultValue={toDateInput(project?.endDate)} />
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-gray-800">Team members</legend>
            <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-gray-200 p-3 sm:grid-cols-3">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="memberIds[]" value={u.id} defaultChecked={project?.memberIds.includes(u.id)} className="h-4 w-4 rounded border-gray-300" />
                  {u.name}
                </label>
              ))}
            </div>
          </fieldset>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Risks, dependencies & internal notes" description="Internal only — never shown on the public website." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <TextAreaField label="Risks" name="risks" defaultValue={project?.risks ?? ""} rows={3} />
          <TextAreaField label="Dependencies" name="dependencies" defaultValue={project?.dependencies ?? ""} rows={3} />
          <TextAreaField label="Internal notes" name="notes" defaultValue={project?.notes ?? ""} rows={3} className="sm:col-span-2" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Public website" description="Projects appear on the public site only when published here and not in draft status." />
        <CardBody className="space-y-4">
          <CheckboxField label="Publish this project on the public website" name="isPublic" defaultChecked={project?.isPublic} hint="Only the public summary, description, cover image and images you mark as public are shown." />
          <TextAreaField label="Public summary" name="publicSummary" defaultValue={project?.publicSummary ?? ""} rows={2} />
          <MediaField name="coverImageId" label="Cover image" initial={project?.coverImage ? { id: project.coverImage.id, url: `/media/${project.coverImage.id}/${encodeURIComponent(project.coverImage.filename)}`, alt: project.coverImage.altText } : null} hint="Must be a public image." />
        </CardBody>
      </Card>
      <SubmitButton pendingLabel="Saving…">{project ? "Save project" : "Create project"}</SubmitButton>
    </ActionForm>
  );
}
