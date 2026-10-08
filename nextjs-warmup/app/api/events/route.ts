import { EVENT_SELECT, fromPostgrest, handler, parseBody, parseQuery, requireUser } from "@/lib/api";
import { eventCreateSchema, eventListQuerySchema } from "@/lib/validation";

// PostgRESTi or-filtris tuleb väärtus jutumärkidesse panna ja erimärgid escape'ida.
const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

// Sündmuste nimekiri. Kalendrivaate jaoks anna from/to - tagastatakse kõik sündmused,
// mis selle vahemikuga kattuvad (ka need, mis algavad enne või lõpevad pärast).
export const GET = handler(async (request: Request) => {
  const { supabase } = await requireUser();
  const { from, to, category_id, q, limit } = parseQuery(request, eventListQuerySchema);

  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .order("start_time", { ascending: true })
    .order("end_time", { ascending: true })
    .limit(limit);

  if (to) query = query.lt("start_time", to);
  if (from) query = query.or(`end_time.gt.${quote(from)},start_time.gte.${quote(from)}`);

  if (category_id === "none") query = query.is("category_id", null);
  else if (category_id) query = query.eq("category_id", category_id);

  if (q) {
    const pattern = quote(`%${escapeLike(q)}%`);
    query = query.or(
      `title.ilike.${pattern},description.ilike.${pattern},location.ilike.${pattern}`,
    );
  }

  const { data, error } = await query;
  if (error) throw fromPostgrest(error);
  return Response.json({ events: data });
});

export const POST = handler(async (request: Request) => {
  const { supabase, user } = await requireUser();
  const input = await parseBody(request, eventCreateSchema);

  const { data, error } = await supabase
    .from("events")
    .insert({ ...input, user_id: user.id })
    .select(EVENT_SELECT)
    .single();
  if (error) throw fromPostgrest(error);
  return Response.json({ event: data }, { status: 201 });
});
