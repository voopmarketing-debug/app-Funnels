import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

// Against a real database. Only runs on purpose:
//   RUN_DB_TESTS=1 npx vitest run accountDeletion.integration
// with DATABASE_URL pointing at a throwaway database (the local development one).
const enabled = !!process.env.RUN_DB_TESTS && !!process.env.DATABASE_URL;

const fetchMp = vi.fn();
const cancelMp = vi.fn();
vi.mock("@/lib/mercadopago", () => ({ fetchMpPreapproval: (...a: unknown[]) => fetchMp(...a), cancelMpPreapproval: (...a: unknown[]) => cancelMp(...a) }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

describe.skipIf(!enabled)("deleteAccount", () => {
  const stamp = `del${Date.now()}`;
  const made = { users: [] as string[], businesses: [] as string[] };
  let prisma: typeof import("@/lib/prisma").prisma;
  let deleteAccount: typeof import("./accountDeletion").deleteAccount;
  const PASSWORD = "UnaClaveLarga123!";

  async function user(label: string, over: Record<string, unknown> = {}) {
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const u = await prisma.user.create({ data: { email: `${stamp}-${label}@test.com`, name: label, passwordHash, ...over } });
    made.users.push(u.id);
    return u;
  }
  async function business(label: string, owners: string[]) {
    const b = await prisma.business.create({ data: { name: `${stamp} ${label}`, slug: `${stamp}-${label}` } });
    made.businesses.push(b.id);
    for (const userId of owners) await prisma.membership.create({ data: { userId, businessId: b.id, role: "OWNER" } });
    return b;
  }
  const exists = async (u: { id: string }) => !!(await prisma.user.findUnique({ where: { id: u.id } }));
  const bizExists = async (b: { id: string }) => !!(await prisma.business.findUnique({ where: { id: b.id } }));

  beforeEach(async () => {
    fetchMp.mockReset();
    cancelMp.mockReset();
    if (!prisma) {
      prisma = (await import("@/lib/prisma")).prisma;
      deleteAccount = (await import("./accountDeletion")).deleteAccount;
    }
    delete process.env.AGENCY_ADMIN_EMAIL;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.rateLimitAttempt.deleteMany({ where: { key: { startsWith: "delete-account:" }, createdAt: { gte: new Date(Date.now() - 600_000) } } });
    await prisma.business.deleteMany({ where: { id: { in: made.businesses } } });
    await prisma.user.deleteMany({ where: { id: { in: made.users } } });
  });

  it("refuses a wrong password and deletes nothing", async () => {
    const u = await user("wrong");
    const b = await business("wrong", [u.id]);
    const res = await deleteAccount(u.id, "otra-clave");
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("contraseña") });
    expect(await exists(u)).toBe(true);
    expect(await bizExists(b)).toBe(true);
  });

  it("deletes the account and the businesses it owns alone, and cancels the subscription first", async () => {
    const u = await user("full", { mpPreapprovalId: "pre_123" });
    const b = await business("full", [u.id]);
    fetchMp.mockResolvedValue({ id: "pre_123", status: "authorized" });
    cancelMp.mockResolvedValue({ ok: true });
    expect(await deleteAccount(u.id, PASSWORD)).toEqual({ ok: true });
    expect(cancelMp).toHaveBeenCalledWith("pre_123");
    expect(await exists(u)).toBe(false);
    expect(await bizExists(b)).toBe(false);
  });

  it("deletes nothing when the subscription cannot be cancelled", async () => {
    const u = await user("nocancel", { mpPreapprovalId: "pre_999" });
    const b = await business("nocancel", [u.id]);
    fetchMp.mockResolvedValue({ id: "pre_999", status: "authorized" });
    cancelMp.mockResolvedValue({ error: "boom" });
    expect(await deleteAccount(u.id, PASSWORD)).toMatchObject({ ok: false });
    expect(await exists(u)).toBe(true);
    expect(await bizExists(b)).toBe(true);
  });

  it("deletes nothing when Mercado Pago cannot even be queried", async () => {
    const u = await user("noquery", { mpPreapprovalId: "pre_000" });
    fetchMp.mockResolvedValue(null);
    expect(await deleteAccount(u.id, PASSWORD)).toMatchObject({ ok: false });
    expect(await exists(u)).toBe(true);
    expect(cancelMp).not.toHaveBeenCalled();
  });

  it("keeps a business that has another owner", async () => {
    const a = await user("coa");
    const c = await user("cob");
    const b = await business("shared", [a.id, c.id]);
    expect(await deleteAccount(a.id, PASSWORD)).toEqual({ ok: true });
    expect(await exists(a)).toBe(false);
    expect(await bizExists(b)).toBe(true);
    expect(await prisma.membership.count({ where: { businessId: b.id, userId: c.id } })).toBe(1);
  });

  it("deletes a salesperson without touching the business", async () => {
    const owner = await user("owner");
    const seller = await user("seller");
    const b = await business("team", [owner.id]);
    await prisma.membership.create({ data: { userId: seller.id, businessId: b.id, role: "MEMBER" } });
    expect(await deleteAccount(seller.id, PASSWORD)).toEqual({ ok: true });
    expect(await exists(seller)).toBe(false);
    expect(await bizExists(b)).toBe(true);
  });

  it("refuses to delete the agency account", async () => {
    const u = await user("agency");
    process.env.AGENCY_ADMIN_EMAIL = u.email;
    expect(await deleteAccount(u.id, PASSWORD)).toMatchObject({ ok: false, error: expect.stringContaining("agencia") });
    expect(await exists(u)).toBe(true);
  });
});
