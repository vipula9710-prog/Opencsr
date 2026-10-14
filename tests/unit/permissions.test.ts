import { describe, expect, it } from "vitest";
import { permissionsForRole, PERMISSIONS, ROLES } from "@/lib/permissions";

describe("role permissions (least privilege)", () => {
  it("org admin has every permission", () => {
    expect(permissionsForRole("ORG_ADMIN").size).toBe(PERMISSIONS.length);
  });
  it("authors cannot publish or administer", () => {
    const p = permissionsForRole("AUTHOR");
    expect(p.has("blog.write")).toBe(true);
    expect(p.has("blog.publish")).toBe(false);
    expect(p.has("users.manage")).toBe(false);
    expect(p.has("org.settings.manage")).toBe(false);
  });
  it("content editors have no financial access", () => {
    const p = permissionsForRole("CONTENT_EDITOR");
    expect(p.has("finance.read")).toBe(false);
    expect(p.has("finance.write")).toBe(false);
    expect(p.has("website.publish")).toBe(true);
  });
  it("viewers are read-only", () => {
    const p = [...permissionsForRole("VIEWER")];
    expect(p.every((x) => x.endsWith(".read"))).toBe(true);
    expect(p).not.toContain("document.confidential");
  });
  it("only org admins manage users", () => {
    for (const r of ROLES) expect(permissionsForRole(r).has("users.manage")).toBe(r === "ORG_ADMIN");
  });
});
