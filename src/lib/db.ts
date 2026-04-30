import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Database } from "@/lib/schema";

export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return (env as Cloudflare.Env).DB;
}

export async function getKysely(): Promise<Kysely<Database>> {
  const d1 = await getDB();
  return new Kysely<Database>({ dialect: new D1Dialect({ database: d1 }) });
}
