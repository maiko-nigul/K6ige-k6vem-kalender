import { EVENT_SELECT, fromPostgrest, handler, parseBody, requireUser } from "@/lib/api";
import { eventUpdateSchema, idParam } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_request: Request, { params }: Ctx) => {
  const id = idParam.parse((await params).id);
  const { supabase } = await requireUser();

  const { data, error } = await supabase.from("events").select(EVENT_SELECT).eq("id", id).single();
  if (error) throw fromPostgrest(error);
  return Response.json({ event: data });
});

// Osaline uuendus - sobib ka drag & drop liigutamiseks / venitamiseks
// (saada ainult start_time ja/või end_time).
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const id = idParam.parse((await params).id);
  const { supabase } = await requireUser();
  const input = await parseBody(request, eventUpdateSchema);

  const { data, error } = await supabase
    .from("events")
    .update(input)
    .eq("id", id)
    .select(EVENT_SELECT)
    .single();
  if (error) throw fromPostgrest(error);
  return Response.json({ event: data });
});

export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const id = idParam.parse((await params).id);
  const { supabase } = await requireUser();

  const { data, error } = await supabase.from("events").delete().eq("id", id).select("id").single();
  if (error) throw fromPostgrest(error);
  return Response.json({ deleted: data.id });
});
