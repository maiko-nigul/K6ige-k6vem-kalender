import { fromPostgrest, handler, parseBody, requireUser } from "@/lib/api";
import { profileUpdateSchema } from "@/lib/validation";

export const GET = handler(async () => {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw fromPostgrest(error);
  return Response.json({
    profile: data ?? { id: user.id, full_name: null, avatar_url: null, updated_at: null },
  });
});

export const PATCH = handler(async (request: Request) => {
  const { supabase, user } = await requireUser();
  const input = await parseBody(request, profileUpdateSchema);

  // upsert juhuks, kui profiili rida pole veel loodud.
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ ...input, id: user.id })
    .select("*")
    .single();
  if (error) throw fromPostgrest(error);
  return Response.json({ profile: data });
});
