"use client";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type {
  CalendarEventWithCategory,
  Category,
  Profile,
} from "@/lib/database.types";
import { api, RequestError } from "./api-client";
import {
  addDays,
  dayKey,
  displayColor,
  eventsOn,
  monthDays,
} from "./calendar-utils";
import { Auth, CategoryForm, EventForm, ProfileForm } from "./forms";
import Icon from "./ui-icon";

type Session = {
  user: { id: string; email?: string };
  profile: Profile | null;
};
type Modal =
  | { kind: "event"; event?: CalendarEventWithCategory; date: Date }
  | { kind: "category"; category?: Category }
  | { kind: "profile" }
  | null;
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const time = (date: string) =>
  new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const colorStyle = (value?: string | null) =>
  ({ "--event-color": displayColor(value) }) as CSSProperties;

export default function CalendarWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [date, setDate] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [today, setToday] = useState(() => new Date());
  const [storedEvents, setEvents] = useState<CalendarEventWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("month");
  const [loadedKey, setLoadedKey] = useState("");
  const [storedError, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const unauthorized = useCallback(() => {
    setSession(null);
    setEvents([]);
    setCategories([]);
    setModal(null);
    setSessionError("");
    setLoadedKey("");
    setCategory("");
    setSearch("");
    setQuery("");
  }, []);
  const checkSession = useCallback(async () => {
    setChecking(true);
    setSessionError("");
    try {
      setSession(await api<Session>("/auth/user"));
    } catch (err) {
      if (err instanceof RequestError && err.status === 401) setSession(null);
      else
        setSessionError(
          err instanceof Error
            ? err.message
            : "Could not connect. Please try again.",
        );
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<Session>("/auth/user")
      .then((data) => {
        if (active) setSession(data);
      })
      .catch((err) => {
        if (active && !(err instanceof RequestError && err.status === 401))
          setSessionError(
            err instanceof Error ? err.message : "Could not connect.",
          );
      })
      .finally(() => {
        if (active) {
          setChecking(false);
          if (new URLSearchParams(window.location.search).has("auth_error"))
            setNotice(
              "The sign-in link could not be verified. Please sign in again.",
            );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const days = monthDays(date);
  const from = days[0].toISOString();
  const to = addDays(days[41], 1).toISOString();
  const requestKey = `${session?.user.id}:${from}:${to}:${category}:${query}:${revision}`;
  const loading = loadedKey !== requestKey;
  const events = loading ? [] : storedEvents;
  const error = loading ? "" : storedError;
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ from, to, limit: "2000" });
    if (category) params.set("category_id", category);
    if (query) params.set("q", query);
    Promise.all([
      api<{ events: CalendarEventWithCategory[] }>(`/events?${params}`, {
        signal: controller.signal,
      }),
      api<{ categories: Category[] }>("/categories", {
        signal: controller.signal,
      }),
    ])
      .then(([eventData, categoryData]) => {
        if (!controller.signal.aborted) {
          setEvents(eventData.events);
          setCategories(categoryData.categories);
          setError("");
          setLoadedKey(requestKey);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          if (err instanceof RequestError && err.status === 401) unauthorized();
          else {
            setError(
              err instanceof Error
                ? err.message
                : "Could not load your calendar.",
            );
            setEvents([]);
            setLoadedKey(requestKey);
          }
        }
      });
    return () => controller.abort();
  }, [session, from, to, category, query, revision, requestKey, unauthorized]);
  function saved(text: string) {
    setModal(null);
    setNotice(text);
    setRevision((value) => value + 1);
  }
  function navigate(amount: number) {
    const next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
    setDate(next);
    setSelected(next);
  }
  function goToday() {
    const now = new Date();
    setDate(now);
    setSelected(now);
  }
  async function logout() {
    setLogoutBusy(true);
    try {
      await api("/auth/logout", { method: "POST" });
      unauthorized();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Sign out failed.");
    } finally {
      setLogoutBusy(false);
    }
  }
  const dayEvents = eventsOn(events, selected);
  const monthLabel = date.toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
  if (checking || sessionError)
    return (
      <main className="connection-screen">
        <div className="brand">
          <span className="brand-mark">k</span> kalender.
        </div>
        {checking ? (
          <>
            <div className="spinner" />
            <p>Finding your calendar…</p>
          </>
        ) : (
          <>
            <h1>Let’s reconnect.</h1>
            <p className="error" role="alert">
              {sessionError}
            </p>
            <button className="primary" onClick={checkSession}>
              Try again
            </button>
          </>
        )}
      </main>
    );
  if (!session)
    return (
      <>
        {notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
        <Auth onSuccess={checkSession} />
      </>
    );
  const name =
    session.profile?.full_name ||
    session.user.email?.split("@")[0] ||
    "Your account";
  return (
    <div className="workspace">
      <a className="skip-link" href="#calendar">
        Skip to calendar
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">k</span> kalender
          <span className="brand-dot">.</span>
        </div>
        <span className="workspace-label">YOUR PERSONAL SPACE</span>
        <button className="nav-active" onClick={() => setView("month")}>
          <Icon name="calendar" /> Calendar <span className="nav-indicator" />
        </button>
        <button
          className="primary new-event"
          onClick={() => setModal({ kind: "event", date: selected })}
        >
          <Icon name="plus" /> Create event
        </button>
        <section className="mini-calendar">
          <header>
            <strong>{monthLabel}</strong>
            <div>
              <button
                className="icon-button"
                aria-label="Previous month"
                onClick={() => navigate(-1)}
              >
                <Icon name="left" />
              </button>
              <button
                className="icon-button"
                aria-label="Next month"
                onClick={() => navigate(1)}
              >
                <Icon name="right" />
              </button>
            </div>
          </header>
          <div className="mini-grid">
            {weekdays.map((day) => (
              <span className="mini-weekday" key={day}>
                {day[0]}
              </span>
            ))}
            {days.map((day) => (
              <button
                key={dayKey(day)}
                className={`${day.getMonth() !== date.getMonth() ? "muted" : ""} ${dayKey(day) === dayKey(selected) ? "mini-selected" : ""}`}
                aria-label={day.toDateString()}
                aria-pressed={dayKey(day) === dayKey(selected)}
                onClick={() => {
                  setSelected(day);
                  if (day.getMonth() !== date.getMonth()) setDate(day);
                }}
              >
                {day.getDate()}
              </button>
            ))}
          </div>
        </section>
        <section className="categories">
          <header>
            <span className="eyebrow">CATEGORIES</span>
            <button
              className="icon-button"
              aria-label="Create category"
              onClick={() => setModal({ kind: "category" })}
            >
              <Icon name="plus" size={16} />
            </button>
          </header>
          <button
            className={`category-filter ${!category ? "active" : ""}`}
            onClick={() => setCategory("")}
          >
            <span className="category-dot all-dot" />
            All events
          </button>
          {categories.map((c) => (
            <div className="category-row" key={c.id}>
              <button
                className={`category-filter ${category === c.id ? "active" : ""}`}
                onClick={() => setCategory(c.id)}
              >
                <span
                  className="category-dot"
                  style={{ background: displayColor(c.color) }}
                />
                <span>{c.name}</span>
              </button>
              <button
                className="category-edit icon-button"
                aria-label={`Edit ${c.name}`}
                onClick={() => setModal({ kind: "category", category: c })}
              >
                ⋯
              </button>
            </div>
          ))}
          <button
            className={`category-filter ${category === "none" ? "active" : ""}`}
            onClick={() => setCategory("none")}
          >
            <span className="category-dot uncategorized-dot" />
            Uncategorized
          </button>
        </section>
        <div className="sidebar-note">
          <Icon name="sparkle" size={26} />
          <p>
            A little planning.
            <br />
            <strong>A lot more possibility.</strong>
          </p>
        </div>
        <div className="account">
          <button
            className="account-profile"
            onClick={() => setModal({ kind: "profile" })}
          >
            <span className="avatar">{name[0].toUpperCase()}</span>
            <span>
              <strong>{name}</strong>
              <small>Personal account</small>
            </span>
          </button>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            disabled={logoutBusy}
            onClick={logout}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <main className="main-workspace" id="calendar">
        <header className="topbar">
          <div>
            <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
            <h1>
              Your calendar<span className="heading-dot">.</span>
            </h1>
          </div>
          <label className="search">
            <Icon name="search" />
            <input
              aria-label="Search events in the displayed dates"
              placeholder="Search events…"
              maxLength={200}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <Icon name="close" size={15} />
              </button>
            )}
          </label>
          <button
            className="mobile-create primary"
            onClick={() => setModal({ kind: "event", date: selected })}
          >
            <Icon name="plus" size={14} /> Event
          </button>
        </header>
        <section className="calendar-toolbar">
          <div className="month-heading">
            <h2>{monthLabel}</h2>
            <span className="month-badge">
              {loading ? "…" : `${events.length} events`}
            </span>
          </div>
          <div className="calendar-controls">
            <button onClick={goToday}>Today</button>
            <div className="arrows">
              <button
                className="icon-button"
                aria-label="Previous month"
                onClick={() => navigate(-1)}
              >
                <Icon name="left" />
              </button>
              <button
                className="icon-button"
                aria-label="Next month"
                onClick={() => navigate(1)}
              >
                <Icon name="right" />
              </button>
            </div>
            <div className="view-toggle" aria-label="Calendar view">
              <button
                aria-pressed={view === "month"}
                className={view === "month" ? "selected" : ""}
                onClick={() => setView("month")}
              >
                Month
              </button>
              <button
                aria-pressed={view === "agenda"}
                className={view === "agenda" ? "selected" : ""}
                onClick={() => setView("agenda")}
              >
                Agenda
              </button>
            </div>
          </div>
        </section>
        {error && (
          <div className="load-error" role="alert">
            <p>{error}</p>
            <button onClick={() => setRevision((r) => r + 1)}>Retry</button>
          </div>
        )}
        {events.length >= 2000 && (
          <p className="load-error">
            Showing the first 2,000 events. Narrow your search or category
            filter.
          </p>
        )}
        <div className="calendar-body">
          <section
            className={`calendar-panel ${view === "agenda" ? "agenda-view" : ""}`}
            aria-label={`${monthLabel} calendar`}
            aria-busy={loading}
          >
            {view === "month" ? (
              <>
                <div className="weekdays">
                  {weekdays.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="month-grid">
                  {days.map((day) => {
                    const items = eventsOn(events, day);
                    const isSelected = dayKey(day) === dayKey(selected);
                    return (
                      <div
                        className={`day-cell ${day.getMonth() !== date.getMonth() ? "outside-month" : ""} ${isSelected ? "selected-day" : ""}`}
                        key={dayKey(day)}
                      >
                        <button
                          className={`day-number ${dayKey(day) === dayKey(today) ? "today-number" : ""}`}
                          aria-label={`Show ${day.toDateString()}, ${items.length} events`}
                          aria-pressed={isSelected}
                          onClick={() => setSelected(day)}
                        >
                          {day.getDate()}
                        </button>
                        <div className="day-events">
                          {loading ? (
                            <div className="skeleton" />
                          ) : (
                            items.slice(0, 3).map((event) => (
                              <button
                                key={event.id}
                                className="event-chip"
                                style={colorStyle(
                                  event.color ?? event.category?.color,
                                )}
                                title={`${event.title} · ${event.is_all_day ? "All day" : time(event.start_time)}`}
                                onClick={() =>
                                  setModal({ kind: "event", event, date: day })
                                }
                              >
                                <span className="event-dot" />
                                <span className="event-title">
                                  {event.title}
                                </span>
                                {!event.is_all_day && (
                                  <small>{time(event.start_time)}</small>
                                )}
                              </button>
                            ))
                          )}
                          {items.length > 3 && (
                            <button
                              className="more-events"
                              onClick={() => setSelected(day)}
                            >
                              +{items.length - 3} more
                            </button>
                          )}
                        </div>
                        <button
                          className="day-add"
                          aria-label={`Create event on ${day.toDateString()}`}
                          onClick={() => setModal({ kind: "event", date: day })}
                        >
                          <Icon name="plus" size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="agenda-list">
                {loading ? (
                  <p className="empty">Loading your events…</p>
                ) : !events.length ? (
                  <div className="empty">
                    <span>
                      <Icon name="sparkle" size={32} />
                    </span>
                    <h3>A little breathing room.</h3>
                    <p>
                      {query || category
                        ? "No events match these filters."
                        : "No events in this month yet."}
                    </p>
                  </div>
                ) : (
                  events.map((event) => (
                    <button
                      key={event.id}
                      className="agenda-event"
                      style={colorStyle(event.color ?? event.category?.color)}
                      onClick={() =>
                        setModal({
                          kind: "event",
                          event,
                          date: new Date(event.start_time),
                        })
                      }
                    >
                      <span className="agenda-date">
                        {new Date(event.start_time).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span>
                        <strong>{event.title}</strong>
                        <small>
                          {event.category?.name ?? "Uncategorized"}
                          {event.location ? ` · ${event.location}` : ""}
                        </small>
                      </span>
                      <span className="agenda-time">
                        {event.is_all_day
                          ? "All day"
                          : `${time(event.start_time)} – ${time(event.end_time)}`}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            <footer className="calendar-footer">
              <span>
                <span className="status-dot" />{" "}
                {loading
                  ? "Loading your calendar"
                  : error
                    ? "Calendar unavailable"
                    : "Your own space, at your own pace"}
              </span>
              <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </footer>
          </section>
          <aside className="day-agenda">
            <div className="agenda-header">
              <span className="eyebrow">
                {dayKey(selected) === dayKey(today)
                  ? "TODAY’S PLAN"
                  : "THE DAY AHEAD"}
              </span>
              <h2>{selected.toLocaleDateString("en", { weekday: "long" })}</h2>
              <p>
                {selected.toLocaleDateString("en", {
                  month: "long",
                  day: "numeric",
                })}
                <span>{dayEvents.length} events</span>
              </p>
            </div>
            {loading ? (
              <div className="agenda-loading">
                <div className="skeleton" />
                <div className="skeleton" />
              </div>
            ) : !dayEvents.length ? (
              <div className="empty">
                <span>
                  <Icon name="sun" size={32} />
                </span>
                <h3>Your day is open.</h3>
                <p>
                  {query || category
                    ? "No matching events for this day."
                    : "Room for something good. Add an event to get started."}
                </p>
              </div>
            ) : (
              <div className="day-agenda-events">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    className="detail-event"
                    style={colorStyle(event.color ?? event.category?.color)}
                    onClick={() =>
                      setModal({ kind: "event", event, date: selected })
                    }
                  >
                    <span className="detail-time">
                      {event.is_all_day
                        ? "ALL DAY"
                        : `${time(event.start_time)} — ${time(event.end_time)}`}
                    </span>
                    <strong>{event.title}</strong>
                    {event.location && (
                      <span className="detail-location">
                        <Icon name="location" size={12} /> {event.location}
                      </span>
                    )}
                    <span className="detail-category">
                      <span className="event-dot" />
                      {event.category?.name ?? "Uncategorized"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button
              className="add-day-event"
              onClick={() => setModal({ kind: "event", date: selected })}
            >
              <Icon name="plus" size={14} /> Add an event
            </button>
            <div className="agenda-bottom">
              <span className="eyebrow">ONE DAY AT A TIME</span>
              <p>Make this one yours.</p>
            </div>
          </aside>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {modal?.kind === "event" && (
        <EventForm
          event={modal.event}
          date={modal.date}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={saved}
          onUnauthorized={unauthorized}
        />
      )}
      {modal?.kind === "category" && (
        <CategoryForm
          category={modal.category}
          onClose={() => setModal(null)}
          onSaved={(text) => {
            setCategory("");
            saved(text);
          }}
          onUnauthorized={unauthorized}
        />
      )}
      {modal?.kind === "profile" && (
        <ProfileForm
          profile={session.profile}
          email={session.user.email}
          onClose={() => setModal(null)}
          onSaved={(profile) => {
            setSession({ ...session, profile });
            saved("Profile saved");
          }}
          onUnauthorized={unauthorized}
        />
      )}
    </div>
  );
}
