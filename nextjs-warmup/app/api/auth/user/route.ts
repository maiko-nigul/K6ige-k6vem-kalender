import { handler, requireUser } from "@/lib/api";

// Praegune kasutaja koos profiiliga (401, kui pole sisse logitud).
export const GET = handler(async () => {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  return Response.json({
    user: { id: user.id, email: user.email, created_at: user.created_at },
    profile,
  });
});
