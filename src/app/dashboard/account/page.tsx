"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut, linkSocial, unlinkAccount, changePassword, authClientFetch } from "@/lib/auth-client";

const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: "var(--surface-white)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-lg)",
      marginBottom: 16,
    }}>
      <h2 style={{
        fontFamily: "var(--font-display)",
        fontSize: 17,
        fontWeight: 600,
        color: "var(--ink)",
        letterSpacing: -0.374,
        marginBottom: 16,
      }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, action }: { label: string; value?: string; action?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 10,
      paddingBottom: 10,
      borderBottom: "1px solid var(--hairline)",
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)", fontWeight: 500 }}>{label}</div>
        {value && <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)", marginTop: 2 }}>{value}</div>}
      </div>
      {action}
    </div>
  );
}

export default function AccountPage() {
  const { data: session, refetch } = useSession();
  const router = useRouter();

  // Password form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Derive whether user has a credential account (email/password)
  // We infer this from whether the session user has an email — better approach
  // is to check accounts list, but that requires a separate API call.
  // We expose a "Set password" flow for all users; better-auth will reject if
  // they already have one (then they use the "Change password" form variant).
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  // GitHub linked status — check via list-accounts API
  const [githubLinked, setGithubLinked] = useState<boolean | null>(null);
  // Load linked accounts on mount
  useEffect(() => {
    fetch("/api/auth/list-accounts", { credentials: "include" })
      .then(r => r.json())
      .then((data: unknown) => {
        const accounts = data as Array<{ provider: string }>;
        return accounts;
      })
      .then((accounts) => {
        setGithubLinked(accounts.some(a => a.provider === "github"));
        setHasPassword(accounts.some(a => a.provider === "credential"));
      })
      .catch(() => {
        setGithubLinked(false);
        setHasPassword(false);
      });
  }, []);

  async function handlePasswordSave() {
    setPasswordError(null);
    setPasswordLoading(true);
    setPasswordSuccess(false);
    try {
      let res;
      if (hasPassword) {
        res = await changePassword({ currentPassword, newPassword });
      } else {
        res = await authClientFetch("/set-password", { method: "POST", body: { newPassword } });
      }
      if (res?.error) throw new Error(res.error.message ?? "Thất bại");
      setPasswordSuccess(true);
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setHasPassword(true);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleLinkGitHub() {
    await linkSocial({ provider: "github", callbackURL: "/dashboard/account" });
  }

  async function handleUnlinkGitHub() {
    const res = await unlinkAccount({ providerId: "github" });
    if (res?.error) {
      alert(res.error.message ?? "Không thể bỏ liên kết");
      return;
    }
    setGithubLinked(false);
    refetch?.();
  }

  function handleExport(format: "json" | "csv") {
    window.location.href = `/api/account/export?format=${format}`;
  }

  if (!session) return null;

  return (
    <div style={{ padding: "24px 16px", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: 22,
        fontWeight: 600,
        color: "var(--ink)",
        letterSpacing: -0.28,
        marginBottom: 24,
      }}>
        Tài khoản
      </h1>

      {/* Profile */}
      <Section title="Thông tin">
        <Row label="Tên" value={session.user.name ?? "—"} />
        <Row label="Email" value={session.user.email} />
      </Section>

      {/* Linked accounts */}
      <Section title="Phương thức đăng nhập">
        <Row
          label="GitHub"
          value={githubLinked === null ? "Đang tải…" : githubLinked ? "Đã liên kết" : "Chưa liên kết"}
          action={
            githubLinked === null ? null : githubLinked ? (
              <button onClick={handleUnlinkGitHub} style={dangerBtnStyle}>
                Bỏ liên kết
              </button>
            ) : (
              <button onClick={handleLinkGitHub} style={linkBtnStyle}>
                <GitHubIcon /> Liên kết
              </button>
            )
          }
        />

        <div style={{ paddingTop: 12 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: showPasswordForm ? 16 : 0,
          }}>
            <div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)", fontWeight: 500 }}>
                {hasPassword ? "Mật khẩu" : "Đặt mật khẩu"}
              </div>
              {passwordSuccess && (
                <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--success, #34c759)", marginTop: 2 }}>
                  Đã lưu thành công
                </div>
              )}
            </div>
            <button
              onClick={() => setShowPasswordForm(v => !v)}
              style={linkBtnStyle}
            >
              {showPasswordForm ? "Huỷ" : hasPassword ? "Đổi mật khẩu" : "Đặt mật khẩu"}
            </button>
          </div>

          {showPasswordForm && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {hasPassword && (
                <input
                  type="password"
                  placeholder="Mật khẩu hiện tại"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  style={inputStyle}
                />
              )}
              <input
                type="password"
                placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={8}
                style={inputStyle}
              />
              {passwordError && (
                <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--danger)", margin: 0 }}>
                  {passwordError}
                </p>
              )}
              <button
                onClick={handlePasswordSave}
                disabled={passwordLoading}
                className="btn-primary"
                style={{ alignSelf: "flex-end" }}
              >
                {passwordLoading ? "…" : "Lưu"}
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Export */}
      <Section title="Xuất dữ liệu">
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--ink-muted-48)",
          lineHeight: 1.5,
          marginBottom: 16,
        }}>
          Tải về toàn bộ giao dịch, danh mục và ngân sách của bạn.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => handleExport("json")} style={exportBtnStyle}>
            Tải JSON
          </button>
          <button onClick={() => handleExport("csv")} style={exportBtnStyle}>
            Tải CSV (giao dịch)
          </button>
        </div>
      </Section>

      {/* Sign out */}
      <Section title="Phiên đăng nhập">
        <button
          onClick={() => signOut({ fetchOptions: { onSuccess: () => router.replace("/") } })}
          style={{ ...dangerBtnStyle, fontSize: 15, padding: "10px 0" }}
        >
          Đăng xuất
        </button>
      </Section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--hairline)",
  background: "var(--canvas)",
  fontFamily: "var(--font-body)",
  fontSize: 15,
  color: "var(--ink)",
  outline: "none",
  boxSizing: "border-box",
};

const linkBtnStyle: React.CSSProperties = {
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
};

const dangerBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--danger, #ff3b30)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  padding: "4px 0",
};

const exportBtnStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--hairline)",
  background: "var(--surface-white)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};
