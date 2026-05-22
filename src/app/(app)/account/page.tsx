"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useSession,
  signOut,
  linkSocial,
  getAuthClientErrorMessage,
  listLinkedAccounts,
} from "@/lib/auth-client";
import {
  deriveLinkedAccountState,
  parseLinkedAccountsResponse,
} from "@/lib/account-password";

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

function SectionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-lg)" }}>
      <div style={{
        fontFamily: "var(--font-body)",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-muted-48)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        paddingLeft: "var(--space-md)",
        marginBottom: "var(--space-xs)",
      }}>
        {label}
      </div>
      <div style={{
        background: "var(--canvas)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  );
}

function ListRow({ icon, label, value, action, isLast = false }: {
  icon?: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  action?: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--space-sm)",
      padding: "12px var(--space-md)",
      borderBottom: isLast ? "none" : "1px solid var(--hairline)",
    }}>
      {icon && (
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-sm)",
          background: "var(--canvas-parchment)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "var(--ink-muted-80)",
        }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-body)",
          fontSize: 16,
          fontWeight: 400,
          color: "var(--ink)",
          lineHeight: 1.3,
        }}>
          {label}
        </div>
        {value && (
          <div style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--ink-muted-48)",
            marginTop: 1,
          }}>
            {value}
          </div>
        )}
      </div>
      {action && (
        <div style={{ flexShrink: 0 }}>
          {action}
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [githubLinked, setGithubLinked] = useState<boolean | null>(null);
  const [googleLinked, setGoogleLinked] = useState<boolean | null>(null);
  const [accountLoadError, setAccountLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;

    let cancelled = false;

    async function loadLinkedAccounts() {
      setAccountLoadError(null);

      try {
        const result = await listLinkedAccounts();
        const errorMessage = getAuthClientErrorMessage(result);
        if (errorMessage) {
          throw new Error(errorMessage);
        }

        const accountState = deriveLinkedAccountState(parseLinkedAccountsResponse(result));
        if (cancelled) return;

        setGithubLinked(accountState.githubLinked);
        setGoogleLinked(accountState.googleLinked);
        setHasPassword(accountState.hasPassword);
      } catch (error) {
        if (cancelled) return;

        setAccountLoadError(error instanceof Error ? error.message : "Không thể tải phương thức đăng nhập");
        setGithubLinked(null);
        setGoogleLinked(null);
        setHasPassword(null);
      }
    }

    void loadLinkedAccounts();

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  async function handleLinkGitHub() {
    await linkSocial({ provider: "github", callbackURL: "/account" });
  }

  function handleExport(format: "json" | "csv") {
    window.location.href = `/api/account/export?format=${format}`;
  }

  if (!session) return null;

  const userInitials = (session.user.name ?? session.user.email ?? "?")
    .split(" ")
    .slice(0, 2)
    .map(s => s[0])
    .join("")
    .toUpperCase();

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--canvas-parchment)",
      paddingBottom: "var(--space-xxl)",
    }}>
      {/* Page header */}
      <div style={{
        padding: "var(--space-xl) var(--space-md) var(--space-lg)",
        maxWidth: 560,
        margin: "0 auto",
      }}>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: 34,
          fontWeight: 700,
          color: "var(--ink)",
          letterSpacing: -0.374,
          margin: 0,
        }}>
          Tài khoản
        </h1>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 var(--space-md)" }}>

        {/* Profile card */}
        <div style={{
          background: "var(--canvas)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          marginBottom: "var(--space-lg)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-md)",
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--primary)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 600,
            flexShrink: 0,
          }}>
            {userInitials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "var(--font-body)",
              fontSize: 17,
              fontWeight: 600,
              color: "var(--ink)",
              letterSpacing: -0.374,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {session.user.name ?? "Người dùng"}
            </div>
            <div style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--ink-muted-48)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {session.user.email}
            </div>
          </div>
        </div>

        {/* Linked accounts */}
        <SectionGroup label="Phương thức đăng nhập">
          {accountLoadError && (
            <div style={{
              padding: "10px var(--space-md)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--danger)",
              borderBottom: "1px solid var(--hairline)",
            }}>
              {accountLoadError}
            </div>
          )}
          <ListRow
            icon={<GitHubIcon />}
            label="GitHub"
            value={
              accountLoadError
                ? "Không thể tải"
                : githubLinked === null
                  ? "Đang tải…"
                  : githubLinked
                    ? "Đã liên kết"
                    : "Chưa liên kết"
            }
            action={
              accountLoadError || githubLinked === null ? null : githubLinked ? (
                <button
                  disabled
                  title="Tạm thời không thể bỏ liên kết GitHub trong lúc các phương thức khác đang bị tắt."
                  style={{ ...unlinkBtnStyle, opacity: 0.35, cursor: "not-allowed" }}
                >
                  Tạm khóa
                </button>
              ) : (
                <button onClick={handleLinkGitHub} style={actionBtnStyle}>
                  <GitHubIcon /> Liên kết
                </button>
              )
            }
          />
          <ListRow
            icon={<GoogleIcon />}
            label="Google"
            value={
              accountLoadError
                ? "Không thể tải"
                : googleLinked === null
                  ? "Đang tải…"
                  : googleLinked
                    ? "Đã liên kết"
                    : "Tạm dừng"
            }
            action={
              <span style={disabledPillStyle}>Sắp có lại</span>
            }
            isLast
          />
        </SectionGroup>

        {/* Password */}
        <SectionGroup label="Mật khẩu">
          <div style={{ padding: "12px var(--space-md)" }}>
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "var(--space-md)",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--ink)",
                  lineHeight: 1.5,
                  marginBottom: 4,
                }}>
                  Email và mật khẩu đang được tạm dừng.
                </div>
                <div style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--ink-muted-48)",
                  lineHeight: 1.6,
                }}>
                  Đăng nhập, đăng ký, đặt mật khẩu và đặt lại mật khẩu sẽ có lại trong thời gian tới.
                  {hasPassword ? " Mật khẩu hiện có của bạn cũng đang tạm thời không sử dụng được." : ""}
                </div>
              </div>
              <span style={disabledPillStyle}>Sắp có lại</span>
            </div>
          </div>
        </SectionGroup>

        {/* Master data */}
        <SectionGroup label="Dữ liệu chính">
          <Link href="/account/categories" style={{ textDecoration: "none" }}>
            <ListRow
              icon={<span style={{ fontSize: 16 }}>⊞</span>}
              label="Danh mục"
              value="Quản lý danh mục thu chi"
              action={<span style={{ color: "var(--ink-muted-48)", fontSize: 18 }}>›</span>}
              isLast
            />
          </Link>
        </SectionGroup>

        {/* Export */}
        <SectionGroup label="Dữ liệu">
          <div style={{ padding: "var(--space-md)" }}>
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--ink-muted-48)",
              lineHeight: 1.5,
              margin: "0 0 var(--space-md)",
            }}>
              Tải về toàn bộ giao dịch, danh mục và ngân sách của bạn.
            </p>
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <button onClick={() => handleExport("json")} style={exportBtnStyle}>
                Tải JSON
              </button>
              <button onClick={() => handleExport("csv")} style={exportBtnStyle}>
                Tải CSV
              </button>
            </div>
          </div>
        </SectionGroup>

        {/* Sign out */}
        <SectionGroup label="Phiên đăng nhập">
          <button
            onClick={() => signOut({ fetchOptions: { onSuccess: () => router.replace("/sign-in") } })}
            style={{
              width: "100%",
              padding: "14px var(--space-md)",
              background: "none",
              border: "none",
              color: "var(--danger)",
              fontFamily: "var(--font-body)",
              fontSize: 16,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Đăng xuất
          </button>
        </SectionGroup>

      </div>
    </div>
  );
}
const actionBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "none",
  border: "none",
  color: "var(--primary)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  padding: "4px 0",
  flexShrink: 0,
};

const unlinkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--danger)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 500,
  padding: "4px 0",
  flexShrink: 0,
};

const disabledPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "var(--canvas-parchment)",
  color: "var(--ink-muted-48)",
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fontWeight: 600,
  flexShrink: 0,
};

const exportBtnStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--hairline)",
  background: "var(--canvas-parchment)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};
