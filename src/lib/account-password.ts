export type LinkedAccount = {
  providerId: string;
};

export type PasswordActionMode = "loading" | "set-password" | "reset-password";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function deriveLinkedAccountState(accounts: LinkedAccount[]) {
  const providerIds = new Set(accounts.map((account) => account.providerId));

  return {
    githubLinked: providerIds.has("github"),
    googleLinked: providerIds.has("google"),
    hasPassword: providerIds.has("credential"),
  };
}

export function getPasswordActionMode({
  hasPassword,
  githubLinked,
  googleLinked,
}: {
  hasPassword: boolean | null;
  githubLinked: boolean | null;
  googleLinked: boolean | null;
}): PasswordActionMode {
  if (hasPassword === null || githubLinked === null || googleLinked === null) {
    return "loading";
  }

  if (!hasPassword && (githubLinked || googleLinked)) {
    return "set-password";
  }

  return "reset-password";
}

export function parseLinkedAccountsResponse(result: unknown): LinkedAccount[] {
  if (!isRecord(result) || !Array.isArray(result.data)) {
    throw new Error("Không thể tải phương thức đăng nhập");
  }

  return result.data.flatMap((account) => {
    if (!isRecord(account) || typeof account.providerId !== "string") {
      return [];
    }

    return [{ providerId: account.providerId }];
  });
}
