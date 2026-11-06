import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateData,
  overlaps,
  localDate,
  shiftDate,
  timeLabel,
} from "../shared/model.js";
const task = (patch = {}) => ({
  id: "a",
  title: "写作",
  priority: "high",
  date: "2026-11-07",
  done: false,
  duration: 30,
  start: 540,
  ...patch,
});
test("validates task data and strips untrusted extra properties", () => {
  const result = validateData({
    version: 1,
    tasks: [task({ title: " 写作 ", extra: "ignore" })],
  });
  assert.equal(result.tasks[0].title, "写作");
  assert.equal(result.tasks[0].extra, undefined);
});
test("rejects malformed imports, duplicate ids and unsupported versions", () => {
  for (const patch of [
    { title: "" },
    { title: "x".repeat(201) },
    { priority: "invalid" },
    { date: "2026-02-30" },
    { done: 1 },
    { start: 1430 },
    { start: -5 },
    { duration: 0 },
    { duration: 31 },
    { start: 543 },
  ]) {
    assert.throws(() => validateData({ version: 1, tasks: [task(patch)] }));
  }
  assert.throws(() => validateData({ version: 2, tasks: [] }));
  assert.throws(() => validateData({ version: 1, tasks: [task(), task()] }));
});
test("allows unplanned tasks and a block ending exactly at midnight", () => {
  assert.equal(
    validateData({ version: 1, tasks: [task({ start: null })] }).tasks[0].start,
    null,
  );
  assert.equal(
    validateData({ version: 1, tasks: [task({ start: 1410 })] }).tasks.length,
    1,
  );
});
test("overlap checking allows adjacent blocks, other days and self edits", () => {
  const existing = [task()];
  assert.equal(overlaps(existing, task({ id: "b", start: 555 })), true);
  assert.equal(overlaps(existing, task({ id: "b", start: 570 })), false);
  assert.equal(overlaps(existing, task({ id: "b", start: 510 })), false);
  assert.equal(overlaps(existing, task({ id: "b", start: null })), false);
  assert.equal(
    overlaps(existing, task({ id: "b", date: "2026-11-08" })),
    false,
  );
  assert.equal(overlaps(existing, task()), false);
});
test("local dates are stable through month, year and leap day transitions", () => {
  assert.equal(localDate(new Date(2026, 10, 7, 0, 1)), "2026-11-07");
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDate("2024-03-01", -1), "2024-02-29");
  assert.equal(timeLabel(545), "09:05");
});
