import { ApiError, handler, parseBody } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validation";

// Seab sessiooni küpsised. Vastuses on ka access_token, et API-t saaks kasutada
// "Authorization: Bearer <token>" päisega (nt curl / Postman).
export const POST = handler(async (request: Request) => {
  const { email, password } = await parseBody(request, signInSchema);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new ApiError(error.status ?? 401, error.message);

  return Response.json({
    user: data.user,
    access_token: data.session.access_token,
    expires_at: data.session.expires_at,
  });
});
