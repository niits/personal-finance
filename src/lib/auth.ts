import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Database } from "@/lib/schema";
import { seedNewUser } from "./seed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInstance: any;

export async function getAuth() {
  if (authInstance) return authInstance;

  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { betterAuth } = await import("better-auth");

  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as Cloudflare.Env & {
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
  };

  authInstance = betterAuth({
    secret: cfEnv.BETTER_AUTH_SECRET,
    baseURL: cfEnv.BETTER_AUTH_URL,
    database: cfEnv.DB,
    socialProviders: {
      github: {
        clientId: cfEnv.GITHUB_CLIENT_ID,
        clientSecret: cfEnv.GITHUB_CLIENT_SECRET,
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const ky = new Kysely<Database>({ dialect: new D1Dialect({ database: cfEnv.DB }) });
            await seedNewUser(ky, user.id);
          },
        },
      },
    },
  });

  return authInstance;
}
