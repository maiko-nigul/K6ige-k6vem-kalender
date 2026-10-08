import { fromPostgrest, handler, parseBody, requireUser } from "@/lib/api";
import { categoryCreateSchema } from "@/lib/validation";

export const GET = handler(async () => {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw fromPostgrest(error);
  return Response.json({ categories: data });
});

export const POST = handler(async (request: Request) => {
  const { supabase, user } = await requireUser();
  const input = await parseBody(request, categoryCreateSchema);

  const { data, error } = await supabase
    .from("categories")
    .insert({ ...input, user_id: user.id })
    .select("*")
    .single();
  if (error) throw fromPostgrest(error);
  return Response.json({ category: data }, { status: 201 });
});
