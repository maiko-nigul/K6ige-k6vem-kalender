# Kalendri backend (Next.js Route Handlers + Supabase)

## Seadistamine

1. Kopeeri `.env.example` → `.env.local` ja täida Supabase'i URL ning anon key.
2. Käivita `supabase/migrations/20261008000000_calendar_schema.sql` Supabase Dashboard → **SQL Editor**.
   See loob puuduvad tabelid (`profiles`, `categories`), lisab `events.category_id`, RLS-i, indeksid ja triggerid.
   Faili võib turvaliselt mitu korda käivitada.
3. `npm run dev`

## Autentimine

Sessioon hoitakse küpsistes (`@supabase/ssr`), `proxy.ts` värskendab seda igal päringul.
Brauserist `fetch("/api/...")` töötab pärast sisselogimist automaatselt.
Testimiseks (curl/Postman) võib saata ka päise `Authorization: Bearer <access_token>`.

| Meetod | Tee | Keha | Vastus |
|---|---|---|---|
| POST | `/api/auth/signup` | `{ email, password, full_name? }` | `{ user, needsEmailConfirmation }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ user, access_token, expires_at }` |
| POST | `/api/auth/logout` | – | `{ ok: true }` |
| GET | `/api/auth/callback?code=…&next=/…` | – | suunab `next` aadressile |
| GET | `/api/auth/user` | – | `{ user, profile }` |

Brauseris võib kasutada ka otse `createClient()` failist `lib/supabase/client.ts`.

## Profiil

| Meetod | Tee | Keha |
|---|---|---|
| GET | `/api/profile` | – |
| PATCH | `/api/profile` | `{ full_name?, avatar_url? }` |

## Kategooriad

| Meetod | Tee | Keha |
|---|---|---|
| GET | `/api/categories` | – |
| POST | `/api/categories` | `{ name, color? }` |
| GET | `/api/categories/:id` | – |
| PATCH | `/api/categories/:id` | `{ name?, color? }` |
| DELETE | `/api/categories/:id` | – (sündmused jäävad alles, `category_id` → `null`) |

`color` on HEX (`#3b82f6`) või Tailwindi nimi (`blue-500`).

## Sündmused

| Meetod | Tee | Keha |
|---|---|---|
| GET | `/api/events?from=&to=&category_id=&q=&limit=` | – |
| POST | `/api/events` | `{ title, start_time, end_time, description?, location?, is_all_day?, color?, category_id? }` |
| GET | `/api/events/:id` | – |
| PATCH | `/api/events/:id` | ükskõik milline ülaltoodud väljadest |
| DELETE | `/api/events/:id` | – |

- Ajad on ISO 8601 koos ajavööndiga, nt `2026-10-08T09:00:00+03:00` või `…Z`.
- `GET /api/events?from=…&to=…` tagastab kõik sündmused, mis **kattuvad** vahemikuga – sobib kuu/nädala/päeva vaate laadimiseks.
- `category_id=none` → ainult kategooriata sündmused. `q` otsib pealkirjast, kirjeldusest ja asukohast.
- Iga sündmus tuleb koos `category: { id, name, color } | null`.
- Drag & drop: saada `PATCH /api/events/:id` kehaga `{ start_time, end_time }`.

## Vead

Kõik vead on kujul `{ error: string, details?: [...] }`:
`400` vigased andmed, `401` pole sisse logitud, `403` keelatud (nt võõras kategooria), `404` ei leitud, `500` serveri viga.

## Failid

- `lib/supabase/` – server/browser/proxy kliendid
- `lib/api.ts` – autentimine, veakäsitlus
- `lib/validation.ts` – zod skeemid
- `lib/database.types.ts` – andmebaasi tüübid (`Category`, `CalendarEvent`, …)
- `app/api/**/route.ts` – API
