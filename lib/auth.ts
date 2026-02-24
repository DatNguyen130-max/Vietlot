import { NextRequest } from "next/server";

function readToken(request: NextRequest): string | null {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice("Bearer ".length).trim();
  }

  return (
    request.headers.get("x-sync-token") ??
    request.nextUrl.searchParams.get("token") ??
    request.nextUrl.searchParams.get("syncToken")
  );
}

export function validateApiToken(request: NextRequest): string | null {
  const expectedTokens = [process.env.SYNC_TOKEN, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value && value.trim())
  );

  if (expectedTokens.length === 0) {
    return null;
  }

  const incoming = readToken(request);
  if (!incoming || !expectedTokens.includes(incoming)) {
    return "Unauthorized";
  }

  return null;
}
