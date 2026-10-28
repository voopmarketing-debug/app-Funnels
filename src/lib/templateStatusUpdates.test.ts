import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/whatsappAlerts", () => ({ alertAgencyOfWhatsAppProblem: vi.fn() }));
import { templateStatusFromEvent } from "./templateStatusUpdates";

describe("templateStatusFromEvent", () => {
  it("maps Meta's events to the three states", () => {
    expect(templateStatusFromEvent("APPROVED", undefined)).toEqual({ status: "APPROVED", rejectionReason: null });
    expect(templateStatusFromEvent("REINSTATED", undefined)?.status).toBe("APPROVED");
    expect(templateStatusFromEvent("REJECTED", "INVALID_FORMAT")).toEqual({ status: "REJECTED", rejectionReason: "INVALID_FORMAT" });
    expect(templateStatusFromEvent("PAUSED", undefined)?.status).toBe("REJECTED");
    expect(templateStatusFromEvent("DISABLED", undefined)?.status).toBe("REJECTED");
    expect(templateStatusFromEvent("PENDING", undefined)?.status).toBe("PENDING");
    expect(templateStatusFromEvent("IN_APPEAL", undefined)?.status).toBe("PENDING");
  });
  it("ignores events that don't change what can be sent", () => {
    expect(templateStatusFromEvent("FLAGGED", undefined)).toBeNull();
    expect(templateStatusFromEvent("PENDING_DELETION", undefined)).toBeNull();
  });
});
