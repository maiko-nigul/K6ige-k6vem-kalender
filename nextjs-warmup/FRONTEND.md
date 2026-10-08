# Calendar frontend

The `/` page renders the calendar workspace or email sign-in/registration and Google sign-in, using the existing cookie-based authentication. No backend, migration, database type, or authorization code was changed.

Google sign-in uses the existing browser client from `lib/supabase/client.ts` and redirects to the existing `/api/auth/callback` code-exchange handler. Enable the Google provider in Supabase Auth, configure its Google OAuth client credentials, and allow the app’s full callback URL (for example, `http://localhost:3000/api/auth/callback`) in Supabase’s redirect URL list. Google’s authorized redirect URI is the Supabase project callback URL shown in its provider settings. See [Supabase’s Google sign-in setup](https://supabase.com/docs/guides/auth/social-login/auth-google). Google secrets belong in the provider settings, not in public frontend environment variables.

## Verified capability mapping

| Interface                    | Existing API                                                           | Contract                                                                           |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Sign in / register           | POST `/api/auth/login`, `/api/auth/signup`                             | Shared Zod schemas; registration handles `needsEmailConfirmation`                  |
| Session / sign out           | GET `/api/auth/user`, POST `/api/auth/logout`                          | Cookie session; 401 clears private UI                                              |
| Profile dialog               | PATCH `/api/profile`                                                   | `full_name`, nullable `avatar_url`; returned `profile`                             |
| Month grid / agenda / search | GET `/api/events`                                                      | ISO `from`/`to` overlap range, `q`, `category_id`, `limit=2000`; returned `events` |
| Event dialog                 | POST `/api/events`, PATCH and DELETE `/api/events/:id`                 | Title, description, location, start/end, all-day flag, category and color          |
| Categories / category dialog | GET and POST `/api/categories`, PATCH and DELETE `/api/categories/:id` | Name and color; deletion preserves events                                          |

Authenticated resource handlers apply existing user authorization and RLS. Forms reuse `lib/validation.ts`. Failed writes preserve the form and show errors, including validation details. Aborted reads cannot overwrite a later navigation. Dates are local to the browser; datetime inputs become ISO timestamps for requests. All-day end dates are exclusive, consistent with the existing overlap query. The grid includes adjacent days in its six-week range; searches and the agenda use that displayed range. The 2,000-record API cap is disclosed when reached.

Event/category detail GET endpoints are available, but list responses already contain the complete fields needed by dialogs. Profile is returned by the existing session endpoint. No additional requests or response structures are needed.

## Scope and verification

Recurrence, tasks, sharing, notifications, multiple calendars, and password recovery initiation have no implemented contracts and are not exposed. Time changes are supported through the event form; drag and drop is not required to edit times.

Run `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `node --test tests/calendar-utils.test.mjs`. A real `.env.local` and configured Supabase database are required for live authenticated verification. Follow `BACKEND.md` for the existing setup instructions. No credentials or example events are shipped with the UI.

Manual checks with an account: sign in/out, registration confirmation, create/edit/delete an event, all-day midnight boundaries, overlapping multi-day events, category CRUD and filtering, text search, profile updates, failed writes, session expiry, keyboard dialog navigation, and narrow mobile layouts.

`tests/frontend-smoke.mjs` exercises the frontend against intercepted, browser-only API contract fixtures. These test fixtures are never loaded by the app and do not validate Supabase itself. To repeat: install Playwright in a temporary location, set `PLAYWRIGHT_PATH` to its package directory (or make it resolvable normally), run the app, and run `node tests/frontend-smoke.mjs`. The default test URL is `http://localhost:3100`; override with `APP_URL`. The runner uses installed Microsoft Edge and writes screenshots under `.next/frontend-check/`. It checks authentication screens, event and category CRUD, all-day timestamps, rejected-write feedback, search/filtering, profile updates, both views, browser runtime errors, and overflow at 320, 390, 768, 1024, and 1440 pixels.
