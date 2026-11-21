import { Button } from "@/components/atoms/Button";

export type OAuthConsentRequest = {
  clientName: string;
  redirectHost: string;
  accountEmail: string;
};

type OAuthConsentTemplateProps = {
  /** null when the consent link is missing, invalid, or expired. */
  request: OAuthConsentRequest | null;
  pending: "allow" | "deny" | null;
  error: string | null;
  onAllow: () => void;
  onDeny: () => void;
};

export function OAuthConsentTemplate({ request, pending, error, onAllow, onDeny }: OAuthConsentTemplateProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-canvas px-5 py-xxl">
      <div className="w-full max-w-[400px]">
        <p className="mb-xs text-center font-display text-sm font-semibold text-ink-muted-48">Personal Finance</p>
        <h1 className="mb-xl text-center font-display text-[28px] font-semibold leading-[33px] text-ink">Cho phép truy cập</h1>

        {request ? (
          <>
            <section aria-label="Yêu cầu truy cập" className="rounded-md border border-hairline bg-surface-pearl px-md py-md">
              <p className="break-words font-body text-[17px] font-semibold leading-[23px] text-ink">{request.clientName}</p>
              <p className="wrap-anywhere font-body text-[13px] leading-[18px] text-ink-muted-48">Chuyển về {request.redirectHost}</p>
              <p className="mt-sm font-body text-[15px] leading-[21px] text-ink-muted-80">
                muốn truy cập tài khoản <span className="wrap-anywhere font-semibold text-ink">{request.accountEmail}</span>.
              </p>
              <p className="mt-sm font-body text-[15px] leading-[21px] text-ink-muted-80">
                Ứng dụng này sẽ xem và thay đổi được toàn bộ dữ liệu tài chính của bạn, như chính bạn.
              </p>
            </section>

            {error ? (
              <div role="alert" className="mt-md rounded-md border border-hairline bg-surface-pearl px-md py-sm font-body text-sm leading-[21px] text-ink-muted-80">{error}</div>
            ) : null}

            <div className="mt-lg flex flex-col gap-sm">
              <Button
                label={pending === "allow" ? "Đang cho phép…" : "Cho phép"}
                fullWidth
                disabled={pending !== null}
                onClick={onAllow}
              />
              <Button
                label={pending === "deny" ? "Đang từ chối…" : "Từ chối"}
                variant="secondary"
                fullWidth
                disabled={pending !== null}
                onClick={onDeny}
              />
            </div>
          </>
        ) : (
          <p role="alert" className="text-center font-body text-[15px] leading-[21px] text-ink-muted-80">
            Liên kết cấp quyền không hợp lệ hoặc đã hết hạn. Hãy kết nối lại từ ứng dụng đã yêu cầu quyền truy cập.
          </p>
        )}
      </div>
    </main>
  );
}
