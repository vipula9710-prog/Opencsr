"use server";

import { act } from "@/server/page";
import type { ActionState } from "@/server/action";
import { ValidationError } from "@/server/errors";
import { importWordPress, WXR_MAX_BYTES } from "@/server/services/wordpress-import";

export async function importWordPressAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose the WordPress export file (.xml)", { file: ["Required"] });
    if (file.size > WXR_MAX_BYTES) throw new ValidationError("The export file is larger than 25 MB", { file: ["Too large"] });
    if (!/\.xml$/i.test(file.name)) throw new ValidationError("Upload the .xml file exported from WordPress", { file: ["Must be an .xml file"] });
    const xml = Buffer.from(await file.arrayBuffer()).toString("utf8");
    return importWordPress(ctx, xml, { importImages: fd.get("importImages") === "on", asDrafts: fd.get("asDrafts") === "on" });
  });
}
