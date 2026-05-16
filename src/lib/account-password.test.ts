import { describe, expect, it } from "vitest";
import {
  deriveLinkedAccountState,
  getPasswordActionMode,
  parseLinkedAccountsResponse,
} from "@/lib/account-password";

describe("deriveLinkedAccountState", () => {
  it("detects linked social accounts and credential password", () => {
    expect(
      deriveLinkedAccountState([
        { providerId: "github" },
        { providerId: "google" },
        { providerId: "credential" },
      ]),
    ).toEqual({
      githubLinked: true,
      googleLinked: true,
      hasPassword: true,
    });
  });

  it("treats unrelated providers as not supported password actions", () => {
    expect(deriveLinkedAccountState([{ providerId: "apple" }])).toEqual({
      githubLinked: false,
      googleLinked: false,
      hasPassword: false,
    });
  });
});

describe("getPasswordActionMode", () => {
  it("shows set password for social-only accounts", () => {
    expect(
      getPasswordActionMode({
        hasPassword: false,
        githubLinked: true,
        googleLinked: false,
      }),
    ).toBe("set-password");
  });

  it("shows reset password when a credential account exists", () => {
    expect(
      getPasswordActionMode({
        hasPassword: true,
        githubLinked: true,
        googleLinked: false,
      }),
    ).toBe("reset-password");
  });

  it("shows reset password when account state does not match the social-only case", () => {
    expect(
      getPasswordActionMode({
        hasPassword: false,
        githubLinked: false,
        googleLinked: false,
      }),
    ).toBe("reset-password");
  });

  it("stays in loading mode until linked accounts finish loading", () => {
    expect(
      getPasswordActionMode({
        hasPassword: null,
        githubLinked: null,
        googleLinked: null,
      }),
    ).toBe("loading");
  });
});

describe("parseLinkedAccountsResponse", () => {
  it("extracts accounts from the Better Auth response payload", () => {
    expect(
      parseLinkedAccountsResponse({
        data: [{ providerId: "github" }, { providerId: "credential" }],
      }),
    ).toEqual([{ providerId: "github" }, { providerId: "credential" }]);
  });

  it("rejects invalid response shapes", () => {
    expect(() => parseLinkedAccountsResponse({ accounts: [] })).toThrow(
      "Không thể tải phương thức đăng nhập",
    );
  });
});
