const CACHE_CONTROL = "private, no-cache";

export async function privateJsonResponse(
  request: Request,
  userId: string,
  body: unknown,
): Promise<Response> {
  const json = JSON.stringify(body);
  const input = new TextEncoder().encode(`${userId}\0${request.url}\0${json}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  const etag = `"${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}"`;
  const headers = { "Cache-Control": CACHE_CONTROL, ETag: etag };

  if (request.headers.get("If-None-Match")?.split(",").some((value) => value.trim() === etag)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(json, {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}
