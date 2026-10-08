import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import type { Database } from "@/lib/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

// Serveris (Server Components, Server Actions, Route Handlers) kasutatav klient.
// Sessioon loetakse küpsistest; kui päringul on "Authorization: Bearer <token>",
// kasutatakse hoopis seda (mugav nt curl'i või mobiilirakenduse jaoks).
export async function createClient() {
  const token = await getBearerToken();
  if (token) {
    return createJsClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Componentist ei saa küpsiseid seada - proxy.ts värskendab sessiooni.
        }
      },
    },
  });
}

export async function getBearerToken() {
  const authorization = (await headers()).get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
