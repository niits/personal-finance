"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useSession,
  signOut,
  linkSocial,
  unlinkAccount,
  getAuthClientErrorMessage,
  listLinkedAccounts,
  requestPasswordResetEmail,
  setAccountPassword,
} from "@/lib/auth-client";
import {
  deriveLinkedAccountState,
  getPasswordActionMode,
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
  const { data: session, refetch } = useSession();
  const router = useRouter();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [githubLinked, setGithubLinked] = useState<boolean | null>(null);
  const [googleLinked, setGoogleLinked] = useState<boolean | null>(null);
  const [accountLoadError, setAccountLoadError] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

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

  const totalAuthMethods =
    (githubLinked ? 1 : 0) + (googleLinked ? 1 : 0) + (hasPassword ? 1 : 0);
  const passwordActionMode = getPasswordActionMode({
    hasPassword,
    githubLinked,
    googleLinked,
  });

  async function handleSetPassword() {
    setPasswordError(null);
    setPasswordLoading(true);
    setPasswordSuccessMessage(null);
    try {
      if (newPassword !== confirmPassword) {
        throw new Error("Mật khẩu xác nhận không khớp.");
      }

      const result = await setAccountPassword({ newPassword });
      const errorMessage = getAuthClientErrorMessage(result);
      if (errorMessage) throw new Error(errorMessage);

      setPasswordSuccessMessage("Đã đặt mật khẩu thành công.");
      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmPassword("");
      setHasPassword(true);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleRequestPasswordReset() {
    setPasswordError(null);
    setPasswordLoading(true);
    setPasswordSuccessMessage(null);

    try {
      const userEmail = session?.user.email;
      if (!userEmail) {
        throw new Error("Tài khoản chưa có email để nhận liên kết đặt lại mật khẩu.");
      }

      const result = await requestPasswordResetEmail({
        email: userEmail,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      const errorMessage = getAuthClientErrorMessage(result);
      if (errorMessage) {
        throw new Error(errorMessage);
      }

      setPasswordSuccessMessage(
        `Nếu địa chỉ email ${userEmail} tồn tại trong hệ thống, email hướng dẫn đặt lại mật khẩu đã được gửi.`,
      );
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleLinkGitHub() {
    await linkSocial({ provider: "github", callbackURL: "/account" });
  }

  async function handleUnlinkGitHub() {
    setUnlinkError(null);
    const res = await unlinkAccount({ providerId: "github" });
    if (res?.error) {
      setUnlinkError(res.error.message ?? "Không thể bỏ liên kết");
      return;
    }
    setGithubLinked(false);
    refetch?.();
  }

  async function handleLinkGoogle() {
    await linkSocial({ provider: "google", callbackURL: "/account" });
  }

  async function handleUnlinkGoogle() {
    setUnlinkError(null);
    const res = await unlinkAccount({ providerId: "google" });
    if (res?.error) {
      setUnlinkError(res.error.message ?? "Không thể bỏ liên kết");
      return;
    }
    setGoogleLinked(false);
    refetch?.();
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
          {(accountLoadError || unlinkError) && (
            <div style={{
              padding: "10px var(--space-md)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--danger)",
              borderBottom: "1px solid var(--hairline)",
            }}>
              {accountLoadError ?? unlinkError}
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
                  onClick={handleUnlinkGitHub}
                  disabled={totalAuthMethods <= 1}
                  title={totalAuthMethods <= 1 ? "Không thể bỏ liên kết phương thức đăng nhập duy nhất" : undefined}
                  style={{ ...unlinkBtnStyle, opacity: totalAuthMethods <= 1 ? 0.35 : 1, cursor: totalAuthMethods <= 1 ? "not-allowed" : "pointer" }}
                >
                  Bỏ liên kết
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
                    : "Chưa liên kết"
            }
            action={
              accountLoadError || googleLinked === null ? null : googleLinked ? (
                <button
                  onClick={handleUnlinkGoogle}
                  disabled={totalAuthMethods <= 1}
                  title={totalAuthMethods <= 1 ? "Không thể bỏ liên kết phương thức đăng nhập duy nhất" : undefined}
                  style={{ ...unlinkBtnStyle, opacity: totalAuthMethods <= 1 ? 0.35 : 1, cursor: totalAuthMethods <= 1 ? "not-allowed" : "pointer" }}
                >
                  Bỏ liên kết
                </button>
              ) : (
                <button onClick={handleLinkGoogle} style={actionBtnStyle}>
                  <GoogleIcon /> Liên kết
                </button>
              )
            }
            isLast
          />
        </SectionGroup>

        {/* Password */}
        <SectionGroup label="Mật khẩu">
          <div style={{ padding: "12px var(--space-md)" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-md)",
              marginBottom: showPasswordForm ? "var(--space-md)" : 0,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--ink-muted-48)",
                  lineHeight: 1.5,
                }}>
                  {passwordActionMode === "set-password"
                    ? "Thêm mật khẩu để bạn có thể đăng nhập bằng email ngoài tài khoản social đã liên kết."
                    : "Chúng tôi sẽ gửi email để bạn đặt lại mật khẩu bằng luồng khôi phục tiêu chuẩn."}
                </div>
                {passwordSuccessMessage && (
                  <div style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--success)",
                    lineHeight: 1.5,
                    marginTop: 8,
                  }}>
                    {passwordSuccessMessage}
                  </div>
                )}
              </div>

              {passwordActionMode === "loading" ? null : passwordActionMode === "set-password" ? (
                <button
                  onClick={() => {
                    setPasswordError(null);
                    setPasswordSuccessMessage(null);
                    setShowPasswordForm((visible) => !visible);
                  }}
                  style={actionBtnStyle}
                >
                  {showPasswordForm ? "Huỷ" : "Đặt mật khẩu"}
                </button>
              ) : (
                <button
                  onClick={handleRequestPasswordReset}
                  disabled={passwordLoading}
                  style={{
                    ...actionBtnStyle,
                    opacity: passwordLoading ? 0.5 : 1,
                    cursor: passwordLoading ? "wait" : "pointer",
                  }}
                >
                  {passwordLoading ? "Đang gửi…" : "Đặt lại mật khẩu"}
                </button>
              )}
            </div>

            {passwordActionMode === "set-password" && showPasswordForm && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="password"
                  placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={8}
                  style={inputStyle}
                />
                <input
                  type="password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  minLength={8}
                  style={inputStyle}
                />
                {passwordError && (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--danger)", margin: 0 }}>
                    {passwordError}
                  </p>
                )}
                <button
                  onClick={handleSetPassword}
                  disabled={passwordLoading}
                  className="btn-primary"
                  style={{ alignSelf: "flex-end" }}
                >
                  {passwordLoading ? "Đang lưu…" : "Lưu mật khẩu"}
                </button>
              </div>
            )}

            {passwordActionMode !== "set-password" && passwordError && (
              <p style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--danger)",
                margin: "12px 0 0",
              }}>
                {passwordError}
              </p>
            )}
          </div>
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
