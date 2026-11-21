import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getKysely } from "@/lib/db";
import { toConsentRequest } from "@/lib/mcp-oauth";
import { ConsentController } from "./ConsentController";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OAuthConsentPage({ searchParams }: PageProps) {
  const { consent_code: consentCode, client_id: clientId } = await searchParams;
  if (typeof consentCode !== "string" || typeof clientId !== "string") {
    return <ConsentController consentCode={null} request={null} />;
  }

  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return <ConsentController consentCode={null} request={null} />;

  const db = await getKysely();
  const client = await db
    .selectFrom("oauthApplication")
    .select(["name", "redirectUrls", "disabled"])
    .where("clientId", "=", clientId)
    .executeTakeFirst();

  return <ConsentController consentCode={consentCode} request={toConsentRequest(client, session.user.email)} />;
}
