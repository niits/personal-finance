import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { seedNewUser } from "@/lib/seed";

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const db = await getKysely();
  await seedNewUser(db, session.user.id);

  return Response.json({ ok: true });
}
