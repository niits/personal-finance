"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, authClient, getAuthClientErrorMessage } from "@/lib/auth-client";

const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [signInPending, setSignInPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const oauthError = searchParams.get("error");
  const wasCancelled = oauthError === "access_denied" || oauthError === "cancelled" || oauthError === "canceled";
  const errorMessage = requestError ?? (oauthError
    ? wasCancelled
      ? "Bạn đã hủy đăng nhập với GitHub. Dữ liệu của bạn không thay đổi."
      : "Không thể đăng nhập với GitHub. Vui lòng thử lại."
    : null);

  useEffect(() => {
    if (session?.user) router.replace("/");
  }, [session, router]);

  async function handleGitHubSignIn() {
    setSignInPending(true);
    setRequestError(null);

    const from = searchParams.get("from");
    const safeDestination = from?.startsWith("/") && !from.startsWith("//") ? from : "/";

    try {
      const result = await signIn.social({
        provider: "github",
        callbackURL: `${window.location.origin}${safeDestination}`,
      });
      const message = getAuthClientErrorMessage(result);
      if (message) {
        setRequestError("Không thể đăng nhập với GitHub. Vui lòng thử lại.");
        setSignInPending(false);
      }
    } catch {
      setRequestError("Không thể đăng nhập với GitHub. Vui lòng thử lại.");
      setSignInPending(false);
    }
  }

  return (
    <main style={{
      minHeight: "100svh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--canvas)",
      padding: "44px 22px 22px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink-muted-48)",
            letterSpacing: 0.1,
            marginBottom: 8,
          }}>
            Personal Finance
          </p>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: -0.28,
          }}>
            Đăng nhập
          </h1>
        </div>

        {errorMessage ? (
          <div role="alert" className="mb-md rounded-md border border-hairline bg-surface-pearl px-md py-sm font-body text-sm leading-[21px] text-ink-muted-80">
            {errorMessage}
          </div>
        ) : null}

        <button type="button"
          onClick={handleGitHubSignIn}
          disabled={sessionPending || signInPending}
          aria-busy={signInPending}
          className="mb-sm flex min-h-11 w-full items-center justify-center gap-xs rounded-md border border-hairline bg-surface-white px-5 py-sm font-body text-[15px] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GitHubIcon />
          {signInPending
            ? "Đang chuyển đến GitHub…"
            : errorMessage
              ? "Thử lại với GitHub"
              : "Tiếp tục với GitHub"}
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
          <ComingSoonCard
            icon={<GoogleIcon />}
            title="Google đang tạm dừng"
            description="Đăng nhập và liên kết Google sẽ quay lại sau khi hệ thống ổn định hơn."
          />
          <ComingSoonCard
            title="Email & mật khẩu đang tạm dừng"
            description="Đăng ký, đăng nhập và khôi phục mật khẩu bằng email sẽ có lại trong thời gian tới."
          />
        </div>
      </div>
    </main>
  );
}

function SignInLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-canvas px-5 py-xxl">
      <div role="status" aria-label="Đang tải trang đăng nhập" className="w-full max-w-[400px]">
        <div className="mx-auto mb-xs h-[18px] w-[120px] rounded-sm bg-divider-soft" />
        <div className="mx-auto mb-xxl h-[33px] w-[140px] rounded-sm bg-divider-soft" />
        <div className="h-11 w-full rounded-md bg-divider-soft" />
        <span className="sr-only">Đang tải…</span>
      </div>
    </main>
  );
}

function ComingSoonCard({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div style={{
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--hairline)",
      background: "var(--surface-pearl)",
      padding: "18px 18px 16px",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 10,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--ink)",
          fontFamily: "var(--font-body)",
          fontSize: 15,
          fontWeight: 600,
        }}>
          {icon ? (
            <span className="size-7 inline-flex items-center justify-center rounded-sm bg-canvas text-ink-muted-80 shrink-0">
              {icon}
            </span>
          ) : null}
          <span>{title}</span>
        </div>
        <span style={badgeStyle}>Sắp có lại</span>
      </div>
      <p style={{
        margin: 0,
        fontFamily: "var(--font-body)",
        fontSize: 14,
        lineHeight: 1.6,
        color: "var(--ink-muted-48)",
      }}>
        {description}
      </p>
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "var(--canvas)",
  color: "var(--ink-muted-48)",
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fontWeight: 600,
  flexShrink: 0,
};
