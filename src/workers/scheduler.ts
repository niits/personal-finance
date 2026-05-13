interface Env {
  CRON_SECRET: string;
  APP_URL: string;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      fetch(`${env.APP_URL}/api/statistics/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }).then((r) => r.json()).catch(console.error),
    );
  },
} satisfies ExportedHandler<Env>;
