import type { PostgrestError, User } from "@supabase/supabase-js";
import { ZodError, type ZodType } from "zod";
import { createClient, getBearerToken } from "@/lib/supabase/server";

// Sündmused tagastatakse koos kategooria nime ja värviga.
export const EVENT_SELECT = "*, category:categories(id, name, color)";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

// Tagastab sisselogitud kasutaja ja tema õigustega Supabase kliendi või viskab 401.
export async function requireUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
}> {
  const supabase = await createClient();
  const token = await getBearerToken();
  const { data, error } = await supabase.auth.getUser(token ?? undefined);
  if (error || !data.user) {
    throw new ApiError(401, "Pole sisse logitud");
  }
  return { supabase, user: data.user };
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Päringu keha peab olema korrektne JSON");
  }
  return schema.parse(body);
}

export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return schema.parse(params);
}

// Postgresi / PostgRESTi veakoodid -> HTTP vastused.
export function fromPostgrest(error: PostgrestError): ApiError {
  switch (error.code) {
    case "PGRST116":
      return new ApiError(404, "Kirjet ei leitud");
    case "23514":
      return new ApiError(400, "Lõpuaeg ei saa olla enne algusaega");
    case "23503":
      return new ApiError(400, "Viidatud kirjet ei eksisteeri");
    case "22P02":
      return new ApiError(400, "Vigane ID");
    case "42501":
      return new ApiError(403, "Puudub õigus (nt kategooria kuulub teisele kasutajale)");
    default:
      return new ApiError(500, "Andmebaasi viga", error.message);
  }
}

// Ühtne veakäsitlus kõigile route handleritele.
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json(
          { error: err.message, ...(err.details ? { details: err.details } : {}) },
          { status: err.status },
        );
      }
      if (err instanceof ZodError) {
        return Response.json(
          {
            error: "Vigased andmed",
            details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
          { status: 400 },
        );
      }
      console.error(err);
      return Response.json({ error: "Serveri viga" }, { status: 500 });
    }
  };
}
