import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Database } from "@/lib/schema";
import { seedNewUser } from "./seed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInstance: any;

export async function getAuth() {
  if (authInstance) return authInstance;

  const [{ getCloudflareContext }, { betterAuth }] = await Promise.all([
    import("@opennextjs/cloudflare"),
    import("better-auth"),
  ]);

  // false positive: getCloudflareContext is destructured from the dynamic import
  // awaited above, so this call cannot race with it — it has a real data dependency.
  // react-doctor-disable-next-line react-doctor/server-sequential-independent-await
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as Cloudflare.Env & {
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    RESEND_API_KEY?: string;
  };

  async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    if (cfEnv.RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cfEnv.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "no-reply@personal-finance.niits.dev",
          to,
          subject,
          html,
        }),
      });
    } else {
      // Dev fallback: log to console so the URL is visible in wrangler preview
      console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${html}`);
    }
  }

  authInstance = betterAuth({
    secret: cfEnv.BETTER_AUTH_SECRET,
    baseURL: cfEnv.BETTER_AUTH_URL,
    database: cfEnv.DB,
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Đặt lại mật khẩu — Personal Finance",
          html: `<p>Xin chào ${user.name ?? user.email},</p>
<p>Nhấn vào liên kết bên dưới để đặt lại mật khẩu của bạn. Liên kết có hiệu lực trong 1 giờ.</p>
<p><a href="${url}">${url}</a></p>
<p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>`,
        });
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["github"],
        // Prevent locking yourself out — must have ≥1 auth method remaining
        allowUnlinkingAll: false,
      },
    },
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
