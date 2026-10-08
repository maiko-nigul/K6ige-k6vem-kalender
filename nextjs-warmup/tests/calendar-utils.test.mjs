import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  dayKey,
  displayColor,
  eventsOn,
  localInput,
  monthDays,
} from "../app/components/calendar-utils.ts";

test("month grid starts Monday and spans the year boundary", () => {
  const days = monthDays(new Date(2027, 0, 15));
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(dayKey(days[0]), "2026-12-28");
  assert.equal(dayKey(days[41]), "2027-02-07");
});
test("day arithmetic preserves local wall time across daylight-saving changes", () => {
  const start = new Date(2026, 9, 24, 9);
  const end = addDays(start, 2);
  assert.equal(end.getHours(), 9);
  assert.equal(dayKey(end), "2026-10-26");
  assert.equal(dayKey(start), "2026-10-24");
});
test("local form input preserves wall time and pads date values", () => {
  assert.equal(localInput(new Date(2026, 0, 2, 9, 5)), "2026-01-02T09:05");
});
test("overlapping events include multi-day events but exclude midnight end boundaries", () => {
  const event = (id, start, end) => ({
    id,
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
  });
  const events = [
    event("spanning", "2026-10-07T10:00", "2026-10-09T10:00"),
    event("ended", "2026-10-07T10:00", "2026-10-08T00:00"),
    event("instant", "2026-10-08T00:00", "2026-10-08T00:00"),
    event("tomorrow", "2026-10-09T00:00", "2026-10-09T01:00"),
  ];
  assert.deepEqual(
    eventsOn(events, new Date(2026, 9, 8)).map((e) => e.id),
    ["spanning", "instant"],
  );
});
test("existing named colors resolve and unrecognized colors have a visible fallback", () => {
  assert.equal(displayColor("bg-blue-500"), "#739ef8");
  assert.equal(displayColor("#abc"), "#abc");
  assert.equal(displayColor("unknown"), "#a78bfa");
});
