import { z } from "zod";

// HEX (#3b82f6, #fff) või Tailwindi värvinimi (blue-500, bg-blue-500).
const color = z
  .string()
  .trim()
  .regex(/^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|[a-z]+(?:-[a-z0-9]+)*)$/, "Vigane värv");

const datetime = z.iso.datetime({ offset: true, message: "Peab olema ISO 8601 aeg ajavööndiga" });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === "" ? null : v));

export const idParam = z.uuid({ message: "Vigane ID" });

// ---------- Profiil ----------
export const profileUpdateSchema = z
  .object({
    full_name: optionalText(200),
    avatar_url: z.url().max(2000).nullish(),
  })
  .strict();

// ---------- Kategooriad ----------
export const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Nimi on kohustuslik").max(100),
    color: color.optional(),
  })
  .strict();

export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Midagi pole muuta");

// ---------- Sündmused ----------
const endNotBeforeStart = (v: { start_time?: string; end_time?: string }) =>
  !v.start_time || !v.end_time || new Date(v.end_time) >= new Date(v.start_time);
const endNotBeforeStartError = {
  message: "Lõpuaeg ei saa olla enne algusaega",
  path: ["end_time"],
};

const eventFields = {
  title: z.string().trim().min(1, "Pealkiri on kohustuslik").max(200),
  description: optionalText(5000),
  location: optionalText(500),
  start_time: datetime,
  end_time: datetime,
  is_all_day: z.boolean(),
  color: color.nullable(),
  category_id: z.uuid().nullable(),
};

export const eventCreateSchema = z
  .object({
    ...eventFields,
    is_all_day: eventFields.is_all_day.default(false),
    color: eventFields.color.optional(),
    category_id: eventFields.category_id.optional(),
  })
  .strict()
  .refine(endNotBeforeStart, endNotBeforeStartError);

export const eventUpdateSchema = z
  .object(eventFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Midagi pole muuta")
  .refine(endNotBeforeStart, endNotBeforeStartError);

// GET /api/events?from=...&to=...&category_id=...&q=...&limit=...
export const eventListQuerySchema = z
  .object({
    from: datetime.optional(),
    to: datetime.optional(),
    category_id: z.union([z.uuid(), z.literal("none")]).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(2000).default(500),
  })
  .refine((v) => !v.from || !v.to || new Date(v.to) > new Date(v.from), {
    message: "'to' peab olema pärast 'from'",
    path: ["to"],
  });

// ---------- Autentimine ----------
export const signUpSchema = z
  .object({
    email: z.email("Vigane e-posti aadress"),
    password: z.string().min(6, "Parool peab olema vähemalt 6 tähemärki"),
    full_name: z.string().trim().max(200).optional(),
  })
  .strict();

export const signInSchema = z
  .object({
    email: z.email("Vigane e-posti aadress"),
    password: z.string().min(1, "Parool on kohustuslik"),
  })
  .strict();

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
