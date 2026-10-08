import { ApiError, handler, parseBody } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { signUpSchema } from "@/lib/validation";

export const POST = handler(async (request: Request) => {
  const { email, password, full_name } = await parseBody(request, signUpSchema);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: full_name ?? null },
      emailRedirectTo: new URL("/api/auth/callback", request.url).toString(),
    },
  });
  if (error) throw new ApiError(error.status ?? 400, error.message);

  return Response.json(
    {
      user: data.user,
      // Kui e-posti kinnitus on Supabase'is sees, on session null kuni kasutaja lingile vajutab.
      needsEmailConfirmation: !data.session,
    },
    { status: 201 },
  );
});
