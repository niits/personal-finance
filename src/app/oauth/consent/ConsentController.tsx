"use client";

import { useState } from "react";
import { authClientFetch } from "@/lib/auth-client";
import { OAuthConsentTemplate, type OAuthConsentRequest } from "@/components/templates/OAuthConsentTemplate";

const CONSENT_ERROR = "Không thể xử lý yêu cầu cấp quyền. Vui lòng thử lại.";

type ConsentControllerProps = {
  consentCode: string | null;
  request: OAuthConsentRequest | null;
};

export function ConsentController({ consentCode, request }: ConsentControllerProps) {
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(accept: boolean) {
    setPending(accept ? "allow" : "deny");
    setError(null);
    try {
      const { data } = await authClientFetch<{ redirectURI: string }>("/oauth2/consent", {
        method: "POST",
        body: { accept, consent_code: consentCode },
      });
      if (data?.redirectURI) {
        // Keep the pending state: the browser is leaving for the client's callback.
        window.location.assign(data.redirectURI);
        return;
      }
    } catch {
      // Network failure falls through to the recoverable error below.
    }
    setError(CONSENT_ERROR);
    setPending(null);
  }

  return (
    <OAuthConsentTemplate
      request={consentCode ? request : null}
      pending={pending}
      error={error}
      onAllow={() => decide(true)}
      onDeny={() => decide(false)}
    />
  );
}
