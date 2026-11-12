import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { membership: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { requireFlowEditor } from "@/lib/authz";
import { FLOW_ACCESS_DENIED } from "@/lib/flowAccess";

describe("requireFlowEditor", () => {
  beforeEach(() => findUnique.mockReset());

  it("lets owners and agency admins through, whatever the flag", async () => {
    findUnique.mockResolvedValue({ role: "OWNER", canManageFlows: false });
    await expect(requireFlowEditor("u", "b")).resolves.toBeUndefined();
    findUnique.mockResolvedValue({ role: "ADMIN", canManageFlows: false });
    await expect(requireFlowEditor("u", "b")).resolves.toBeUndefined();
  });

  it("lets a salesperson through only while the owner keeps the permission on", async () => {
    findUnique.mockResolvedValue({ role: "MEMBER", canManageFlows: true });
    await expect(requireFlowEditor("u", "b")).resolves.toBeUndefined();
    findUnique.mockResolvedValue({ role: "MEMBER", canManageFlows: false });
    await expect(requireFlowEditor("u", "b")).rejects.toThrow(FLOW_ACCESS_DENIED);
  });

  it("rejects someone who is not part of the business", async () => {
    findUnique.mockResolvedValue(null);
    await expect(requireFlowEditor("u", "b")).rejects.toThrow(FLOW_ACCESS_DENIED);
  });
});
