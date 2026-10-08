import { ApiError, handler } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export const POST = handler(async () => {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new ApiError(error.status ?? 500, error.message);
  return Response.json({ ok: true });
});
