"use client";
import { useState, type FormEvent } from "react";
import type {
  CalendarEventWithCategory,
  Category,
  Profile,
} from "@/lib/database.types";
import {
  categoryCreateSchema,
  eventCreateSchema,
  profileUpdateSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation";
import { api } from "./api-client";
import { addDays, dayKey, localInput } from "./calendar-utils";
import Dialog from "./dialog";
import GoogleLoginButton from "./google-login-button";

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
function parse<T>(
  result:
    | { success: true; data: T }
    | { success: false; error: { issues: { message: string }[] } },
) {
  if (!result.success)
    throw new Error(result.error.issues.map((i) => i.message).join(" · "));
  return result.data;
}

export function Auth({ onSuccess }: { onSuccess: () => void }) {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const input = {
        email: String(form.get("email")),
        password: String(form.get("password")),
        ...(signup ? { full_name: String(form.get("full_name")) } : {}),
      };
      const body = parse(
        (signup ? signUpSchema : signInSchema).safeParse(input),
      );
      const result = await api<{ needsEmailConfirmation?: boolean }>(
        `/auth/${signup ? "signup" : "login"}`,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (result.needsEmailConfirmation)
        setNotice("Check your email to confirm your account, then sign in.");
      else onSuccess();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <div className="brand">
          <span className="brand-mark">k</span> kalender
          <span className="brand-dot">.</span>
        </div>
        <div>
          <span className="eyebrow">A LITTLE SPACE FOR YOUR DAY</span>
          <h1>
            Good days
            <br />
            start with
            <br />
            <span>a clear plan.</span>
          </h1>
          <p>
            Your events, beautifully organized.
            <br />
            Make room for what matters.
          </p>
        </div>
        <span className="auth-foot">Less noise. More clarity.</span>
      </div>
      <main className="auth-main">
        <form className="auth-card" onSubmit={submit}>
          <span className="eyebrow">WELCOME TO KALENDER</span>
          <h2>{signup ? "Make yourself at home." : "Welcome back."}</h2>
          <p>
            {signup
              ? "Create your account to get started."
              : "Sign in to find your day, all in one place."}
          </p>
          <fieldset disabled={busy}>
            <GoogleLoginButton
              disabled={busy}
              onPendingChange={setBusy}
              onError={setError}
            />
            <div className="auth-divider" aria-hidden="true">
              või e-postiga
            </div>
            {signup && (
              <label>
                Full name
                <input
                  name="full_name"
                  autoComplete="name"
                  maxLength={200}
                  placeholder="Your name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 6 : 1}
                required
                placeholder={signup ? "At least 6 characters" : "Your password"}
              />
            </label>
            <button className="primary wide">
              {busy
                ? "Please wait…"
                : signup
                  ? "Create account →"
                  : "Sign in →"}
            </button>
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="success" role="status">
              {notice}
            </p>
          )}
          <p className="auth-switch">
            {signup ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setSignup(!signup);
                setError("");
                setNotice("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}

export function EventForm({
  event,
  date,
  categories,
  onClose,
  onSaved,
  onUnauthorized,
}: {
  event?: CalendarEventWithCategory;
  date: Date;
  categories: Category[];
  onClose: () => void;
  onSaved: (notice: string) => void;
  onUnauthorized: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allDay, setAllDay] = useState(Boolean(event?.is_all_day));
  const [deleting, setDeleting] = useState(false);
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const startDate = new Date(
        `${form.get("start")}${allDay ? "T00:00:00" : ""}`,
      );
      const endDate = new Date(
        `${form.get("end")}${allDay ? "T00:00:00" : ""}`,
      );
      const body = parse(
        eventCreateSchema.safeParse({
          title: form.get("title"),
          description: form.get("description"),
          location: form.get("location"),
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          is_all_day: allDay,
          category_id: form.get("category_id") || null,
          color: form.get("color") || null,
        }),
      );
      await api(`/events${event ? `/${event.id}` : ""}`, {
        method: event ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onSaved(event ? "Event updated" : "Event created");
    } catch (err) {
      setError(message(err));
      if ((err as { status?: number }).status === 401) onUnauthorized();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api(`/events/${event!.id}`, { method: "DELETE" });
      onSaved("Event deleted");
    } catch (err) {
      setError(message(err));
      if ((err as { status?: number }).status === 401) onUnauthorized();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={event ? "Event details" : "A new moment"}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Event title
            <input
              autoFocus
              name="title"
              defaultValue={event?.title}
              required
              maxLength={200}
              placeholder="What’s happening?"
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />{" "}
            All-day event
          </label>
          <div className="form-row">
            <label>
              Starts
              <input
                key={`start-${allDay}`}
                name="start"
                type={allDay ? "date" : "datetime-local"}
                required
                defaultValue={
                  allDay
                    ? dayKey(new Date(event?.start_time ?? start))
                    : localInput(event?.start_time ?? start)
                }
              />
            </label>
            <label>
              Ends
              <input
                key={`end-${allDay}`}
                name="end"
                type={allDay ? "date" : "datetime-local"}
                required
                defaultValue={
                  allDay
                    ? dayKey(new Date(event?.end_time ?? addDays(start, 1)))
                    : localInput(event?.end_time ?? end)
                }
              />
            </label>
          </div>
          <p className="field-hint">
            Times use your device timezone. All-day end dates are exclusive.
          </p>
          <div className="form-row">
            <label>
              Category
              <select
                name="category_id"
                defaultValue={event?.category_id ?? ""}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Event color
              <input
                name="color"
                defaultValue={event?.color ?? ""}
                placeholder="Inherit category color"
                pattern="(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|[a-z]+(-[a-z0-9]+)*)"
              />
            </label>
          </div>
          <label>
            Location
            <input
              name="location"
              defaultValue={event?.location ?? ""}
              maxLength={500}
              placeholder="Add a place or meeting link"
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              defaultValue={event?.description ?? ""}
              maxLength={5000}
              rows={3}
              placeholder="A few details for later…"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer className="form-footer">
            {event && (
              <button
                type="button"
                className="danger"
                onClick={() => setDeleting(true)}
              >
                Delete event
              </button>
            )}
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary">
              {busy ? "Saving…" : "Save event"}
            </button>
          </footer>
          {deleting && (
            <div className="confirm">
              <p>Delete this event permanently?</p>
              <button type="button" onClick={() => setDeleting(false)}>
                Keep event
              </button>
              <button type="button" className="danger" onClick={remove}>
                Confirm delete
              </button>
            </div>
          )}
        </fieldset>
      </form>
    </Dialog>
  );
}

export function CategoryForm({
  category,
  onClose,
  onSaved,
  onUnauthorized,
}: {
  category?: Category;
  onClose: () => void;
  onSaved: (notice: string) => void;
  onUnauthorized: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  async function mutate(method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(`/categories${category ? `/${category.id}` : ""}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      onSaved(
        method === "DELETE"
          ? "Category deleted; events kept"
          : "Category saved",
      );
    } catch (err) {
      setError(message(err));
      if ((err as { status?: number }).status === 401) onUnauthorized();
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const body = parse(
        categoryCreateSchema.safeParse({
          name: form.get("name"),
          color: form.get("color"),
        }),
      );
      void mutate(category ? "PATCH" : "POST", body);
    } catch (err) {
      setError(message(err));
    }
  }
  return (
    <Dialog
      title={category ? "Edit category" : "Create category"}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Name
            <input
              autoFocus
              name="name"
              required
              maxLength={100}
              defaultValue={category?.name}
              placeholder="e.g. Personal"
            />
          </label>
          <label>
            Color
            <input
              name="color"
              required
              defaultValue={category?.color ?? "#a78bfa"}
              placeholder="#a78bfa or violet-400"
            />
          </label>
          <p className="field-hint">
            Use a hex color or a color name such as blue-500.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer className="form-footer">
            {category && (
              <button
                type="button"
                className="danger"
                onClick={() => setDeleting(true)}
              >
                Delete
              </button>
            )}
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary">
              {busy ? "Saving…" : "Save category"}
            </button>
          </footer>
          {deleting && (
            <div className="confirm">
              <p>
                Delete this category? Its events will stay in your calendar
                without a category.
              </p>
              <button type="button" onClick={() => setDeleting(false)}>
                Keep category
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => void mutate("DELETE")}
              >
                Confirm delete
              </button>
            </div>
          )}
        </fieldset>
      </form>
    </Dialog>
  );
}

export function ProfileForm({
  profile,
  email,
  onClose,
  onSaved,
  onUnauthorized,
}: {
  profile: Profile | null;
  email?: string;
  onClose: () => void;
  onSaved: (profile: Profile) => void;
  onUnauthorized: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const body = parse(
        profileUpdateSchema.safeParse({
          full_name: form.get("full_name"),
          avatar_url: form.get("avatar_url") || null,
        }),
      );
      const result = await api<{ profile: Profile }>("/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onSaved(result.profile);
    } catch (err) {
      setError(message(err));
      if ((err as { status?: number }).status === 401) onUnauthorized();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Your profile" onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <p className="field-hint">{email}</p>
          <label>
            Full name
            <input
              autoFocus
              name="full_name"
              maxLength={200}
              defaultValue={profile?.full_name ?? ""}
            />
          </label>
          <label>
            Avatar URL
            <input
              type="url"
              name="avatar_url"
              maxLength={2000}
              defaultValue={profile?.avatar_url ?? ""}
              placeholder="https://…"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer className="form-footer">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary">
              {busy ? "Saving…" : "Save profile"}
            </button>
          </footer>
        </fieldset>
      </form>
    </Dialog>
  );
}
