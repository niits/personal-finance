import { describe, it, expect } from "vitest";
import { Errors } from "@/lib/errors";

describe("Errors.unauthorized", () => {
  it("returns 401 status", async () => {
    const res = Errors.unauthorized();
    expect(res.status).toBe(401);
  });

  it("body has UNAUTHORIZED code", async () => {
    const body = await Errors.unauthorized().json();
    expect(body.code).toBe("UNAUTHORIZED");
    expect(body.error).toBe("Unauthorized");
  });
});

describe("Errors.forbidden", () => {
  it("returns 403 status", () => {
    expect(Errors.forbidden().status).toBe(403);
  });

  it("body has FORBIDDEN code", async () => {
    const body = await Errors.forbidden().json();
    expect(body.code).toBe("FORBIDDEN");
  });
});

describe("Errors.notFound", () => {
  it("returns 404 status", () => {
    expect(Errors.notFound().status).toBe(404);
  });

  it("uses default message when none provided", async () => {
    const body = await Errors.notFound().json();
    expect(body.error).toBe("Not found");
    expect(body.code).toBe("NOT_FOUND");
  });

  it("uses custom message when provided", async () => {
    const body = await Errors.notFound("Transaction not found").json();
    expect(body.error).toBe("Transaction not found");
  });
});

describe("Errors.conflict", () => {
  it("returns 409 status", () => {
    expect(Errors.conflict("Duplicate entry").status).toBe(409);
  });

  it("uses default CONFLICT code", async () => {
    const body = await Errors.conflict("Already exists").json();
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toBe("Already exists");
  });

  it("accepts custom code", async () => {
    const body = await Errors.conflict("Budget exists", "BUDGET_EXISTS").json();
    expect(body.code).toBe("BUDGET_EXISTS");
  });

  it("includes details when provided", async () => {
    const body = await Errors.conflict("Conflict", "CONFLICT", { field: "month" }).json();
    expect(body.details).toEqual({ field: "month" });
  });

  it("omits details key when not provided", async () => {
    const body = await Errors.conflict("Conflict").json();
    expect("details" in body).toBe(false);
  });
});

describe("Errors.validation", () => {
  it("returns 400 status", () => {
    expect(Errors.validation("Bad input").status).toBe(400);
  });

  it("body has VALIDATION_ERROR code", async () => {
    const body = await Errors.validation("Bad input").json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toBe("Bad input");
  });

  it("includes details when provided", async () => {
    const body = await Errors.validation("Invalid", { amount: "must be positive" }).json();
    expect(body.details).toEqual({ amount: "must be positive" });
  });

  it("omits details key when not provided", async () => {
    const body = await Errors.validation("Bad").json();
    expect("details" in body).toBe(false);
  });
});

describe("Errors.internal", () => {
  it("returns 500 status", () => {
    expect(Errors.internal().status).toBe(500);
  });

  it("body has INTERNAL_ERROR code", async () => {
    const body = await Errors.internal().json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
