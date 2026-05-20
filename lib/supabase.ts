import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function normalizeSupabaseUrl(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("SUPABASE_URL is invalid. Expected format: https://<project-ref>.supabase.co");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("SUPABASE_URL must start with http:// or https://");
  }

  return parsed.toString().replace(/\/+$/, "");
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

function validateServiceRoleKey(value: string): void {
  if (value.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is using a publishable key. Use the service_role secret key from Supabase."
    );
  }

  const jwtPayload = decodeJwtPayload(value);
  if (jwtPayload?.role === "anon") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is using anon JWT. Use the service_role secret key from Supabase.");
  }
}

export function getSupabaseAdmin(): SupabaseClient {
  if (client) {
    return client;
  }

  const supabaseUrl = normalizeSupabaseUrl(getRequiredEnv("SUPABASE_URL"));
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  validateServiceRoleKey(serviceRoleKey);

  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return client;
}
