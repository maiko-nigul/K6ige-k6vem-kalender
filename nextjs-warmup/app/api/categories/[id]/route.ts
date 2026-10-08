import { fromPostgrest, handler, parseBody, requireUser } from "@/lib/api";
import { categoryUpdateSchema, idParam } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_request: Request, { params }: Ctx) => {
  const id = idParam.parse((await params).id);
  const { supabase } = await requireUser();

  const { data, error } = await supabase.from("categories").select("*").eq("id", id).single();
  if (error) throw fromPostgrest(error);
  return Response.json({ category: data });
});

export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const id = idParam.parse((await params).id);
  const { supabase } = await requireUser();
  const input = await parseBody(request, categoryUpdateSchema);

  const { data, error } = await supabase
    .from("categories")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw fromPostgrest(error);
  return Response.json({ category: data });
});

// Kategooria kustutamisel jäävad sündmused alles (category_id -> null).
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const id = idParam.parse((await params).id);
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw fromPostgrest(error);
  return Response.json({ deleted: data.id });
});
