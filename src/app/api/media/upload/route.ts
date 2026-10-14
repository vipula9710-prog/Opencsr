import { NextResponse } from "next/server";
import { getOrgContext } from "@/server/auth/session";
import { publicMediaUrl, uploadMedia } from "@/server/services/media";
import { assertSameOrigin, errorResponse } from "@/server/http";
import { UnauthenticatedError, ValidationError } from "@/server/errors";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ctx = await getOrgContext();
    if (!ctx) throw new UnauthenticatedError();
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose a file");
    const asset = await uploadMedia(ctx, {
      filename: file.name,
      data: Buffer.from(await file.arrayBuffer()),
      visibility: fd.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      altText: (fd.get("altText") as string) || null,
    });
    return NextResponse.json({ item: { id: asset.id, url: publicMediaUrl(asset), alt: asset.altText ?? "", filename: asset.filename, mimeType: asset.mimeType } });
  } catch (err) {
    return errorResponse(err);
  }
}
