// Browser-only contract fixtures. These are never imported by the application.
// Requires Playwright and a running app; see FRONTEND.md.
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_PATH
    ? pathToFileURL(path.join(process.env.PLAYWRIGHT_PATH, "index.mjs")).href
    : "playwright"
);

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Europe/Tallinn",
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  let signedIn = false;
  let rejectWrite = false;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9);
  const end = new Date(start);
  end.setHours(10);
  const category = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    user_id: "test-user",
    name: "Test category",
    color: "#72cba7",
    created_at: now.toISOString(),
  };
  let categories = [category];
  let events = [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      user_id: "test-user",
      category_id: category.id,
      title: "Contract test event",
      description: "Browser-only fixture",
      location: "Test location",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      is_all_day: false,
      color: null,
      category,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ];
  const mutations = [];
  const profile = {
    id: "test-user",
    full_name: "Browser tester",
    avatar_url: null,
    updated_at: null,
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const reply = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.pathname === "/api/auth/user")
      return signedIn
        ? reply({
            user: { id: "test-user", email: "test@example.com" },
            profile,
          })
        : reply({ error: "Unauthorized" }, 401);
    if (url.pathname === "/api/auth/signup")
      return reply(
        { user: { id: "test-user" }, needsEmailConfirmation: true },
        201,
      );
    if (url.pathname === "/api/auth/login") {
      signedIn = true;
      return reply({
        user: { id: "test-user" },
        access_token: "test-only",
        expires_at: 0,
      });
    }
    if (url.pathname === "/api/auth/logout") {
      signedIn = false;
      return reply({ ok: true });
    }
    if (!signedIn) return reply({ error: "Unauthorized" }, 401);
    if (method !== "GET") {
      const body = method === "DELETE" ? null : request.postDataJSON();
      mutations.push({ path: url.pathname, method, body });
      if (rejectWrite)
        return reply({ error: "Write rejected by test backend" }, 403);
      if (url.pathname === "/api/profile") {
        Object.assign(profile, body);
        return reply({ profile });
      }
      if (url.pathname.startsWith("/api/events")) {
        if (method === "DELETE") {
          events = [];
          return reply({ deleted: "550e8400-e29b-41d4-a716-446655440001" });
        }
        const event = {
          ...events[0],
          ...body,
          id: events[0]?.id || "550e8400-e29b-41d4-a716-446655440001",
          category: body.category_id ? category : null,
        };
        events = [event];
        return reply({ event }, method === "POST" ? 201 : 200);
      }
      if (url.pathname.startsWith("/api/categories")) {
        if (method === "DELETE") {
          categories = [];
          events = events.map((event) => ({
            ...event,
            category_id: null,
            category: null,
          }));
          return reply({ deleted: category.id });
        }
        Object.assign(category, body);
        categories = [category];
        return reply({ category }, method === "POST" ? 201 : 200);
      }
    }
    if (url.pathname === "/api/categories") return reply({ categories });
    if (url.pathname === "/api/events") {
      const q = url.searchParams.get("q")?.toLowerCase();
      return reply({
        events: events.filter(
          (event) =>
            (!q || event.title.toLowerCase().includes(q)) &&
            (!url.searchParams.get("category_id") ||
              (url.searchParams.get("category_id") === "none"
                ? !event.category_id
                : event.category_id === url.searchParams.get("category_id"))),
        ),
      });
    }
    return reply({ error: "Unexpected test request" }, 500);
  });
  const screenshots = path.resolve(".next/frontend-check");
  fs.mkdirSync(screenshots, { recursive: true });
  await page.goto(process.env.APP_URL || "http://localhost:3100");
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.screenshot({
    path: path.join(screenshots, "auth-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Create account →" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Check your email" })
    .waitFor();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Sign in →" }).click();
  await page
    .getByRole("button", { name: /Contract test event/ })
    .first()
    .waitFor();
  await page.screenshot({
    path: path.join(screenshots, "calendar-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: /Contract test event/ })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Event title").fill("Updated contract event");
  rejectWrite = true;
  await page.getByRole("button", { name: "Save event" }).click();
  await page.getByRole("alert").filter({ hasText: "Write rejected" }).waitFor();
  assert.equal(
    await page.getByRole("dialog").count(),
    1,
    "failed write keeps dialog open",
  );
  rejectWrite = false;
  await page.getByRole("button", { name: "Save event" }).click();
  await page
    .getByRole("button", { name: /Updated contract event/ })
    .first()
    .waitFor();
  assert.equal(mutations.at(-1).method, "PATCH");
  assert.equal(mutations.at(-1).body.title, "Updated contract event");
  assert.match(mutations.at(-1).body.start_time, /Z$/);
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await page
    .getByRole("textbox", { name: /Search events/ })
    .fill("no-match-for-this-test");
  await page
    .getByRole("heading", { name: "A little breathing room." })
    .waitFor();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page
    .getByRole("button", { name: /Updated contract event/ })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Uncategorized", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A little breathing room." })
    .waitFor();
  await page.getByRole("button", { name: "All events", exact: true }).click();
  await page
    .getByRole("button", { name: /Updated contract event/ })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Edit Test category", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Renamed category");
  await page.getByRole("button", { name: "Save category" }).click();
  await page
    .getByRole("button", { name: "Edit Renamed category", exact: true })
    .waitFor();
  assert.equal(mutations.at(-1).method, "PATCH");
  await page
    .getByRole("button", { name: "Edit Renamed category", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Updated contract event/ })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Edit Renamed category", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(mutations.at(-1).method, "DELETE");
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page.getByRole("button", { name: "Create event", exact: true }).click();
  await page.getByLabel("Event title").fill("All-day contract event");
  await page.getByLabel("All-day event").check();
  await page.getByRole("button", { name: "Save event" }).click();
  await page
    .getByRole("button", { name: /All-day contract event/ })
    .first()
    .waitFor();
  const allDay = mutations.at(-1);
  assert.equal(allDay.method, "POST");
  assert.equal(allDay.body.is_all_day, true);
  const localStart = await page.evaluate(
    (value) => new Date(value).getHours(),
    allDay.body.start_time,
  );
  assert.equal(localStart, 0, "all-day inputs become local midnight");
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await page
    .getByRole("button", { name: /All-day contract event/ })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: /All-day contract event/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Delete event", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await page
    .getByRole("heading", { name: "A little breathing room." })
    .waitFor();
  assert.equal(mutations.at(-1).method, "DELETE");
  await page
    .getByRole("button", { name: "Create category", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("New category");
  await page.getByRole("button", { name: "Save category" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Category saved" })
    .waitFor();
  assert.equal(mutations.at(-1).path, "/api/categories");
  await page
    .getByRole("button", { name: /Browser tester Personal account/ })
    .click();
  await page.getByLabel("Full name").fill("Updated name");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page
    .getByRole("button", { name: /Updated name Personal account/ })
    .waitFor();
  assert.equal(mutations.at(-1).path, "/api/profile");
  await page.getByRole("button", { name: "Month", exact: true }).click();
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflow) {
      console.error(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll("body *"))
            .filter(
              (element) =>
                element.getBoundingClientRect().right > window.innerWidth + 1,
            )
            .map((element) => ({
              tag: element.tagName,
              class: element.className,
              right: element.getBoundingClientRect().right,
            }))
            .slice(0, 15),
        ),
      );
      await page.screenshot({
        path: path.join(screenshots, "overflow.png"),
        fullPage: true,
      });
    }
    assert.equal(overflow, false, `no horizontal overflow at ${width}px`);
    if (width === 390)
      await page.screenshot({
        path: path.join(screenshots, "calendar-mobile.png"),
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  assert.deepEqual(runtimeErrors, [], "no browser runtime errors");
  await browser.close();
  console.log(
    "PASS: auth confirmation/login/logout, event create/edit/delete, failed-write feedback, all-day timestamps, category create/edit/delete, search and filtering, profile editing, month/agenda, five responsive widths, and no browser runtime errors. Browser-only fixtures; real Supabase was not tested.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
