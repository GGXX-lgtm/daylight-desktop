export const PRIORITIES = ["high", "normal", "later"];
export const EMPTY_DATA = { version: 1, tasks: [] };
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
}
export function validateData(data) {
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.tasks) ||
    data.tasks.length > 10000
  )
    throw new Error("数据格式不受支持");
  const ids = new Set();
  const tasks = data.tasks.map((t) => {
    if (!t || typeof t.id !== "string" || t.id.length > 100 || ids.has(t.id))
      throw new Error("任务标识无效或重复");
    ids.add(t.id);
    if (typeof t.title !== "string" || !t.title.trim() || t.title.length > 200)
      throw new Error("任务名称需要 1–200 个字符");
    if (
      !PRIORITIES.includes(t.priority) ||
      !isDate(t.date) ||
      typeof t.done !== "boolean"
    )
      throw new Error("任务属性无效");
    if (
      !Number.isInteger(t.duration) ||
      t.duration < 5 ||
      t.duration > 480 ||
      t.duration % 5
    )
      throw new Error("时长需要为 5–480 分钟，且是 5 的倍数");
    if (
      t.start !== null &&
      (!Number.isInteger(t.start) ||
        t.start < 0 ||
        t.start + t.duration > 1440 ||
        t.start % 5)
    )
      throw new Error("时间区块必须在当天内，且对齐 5 分钟");
    return {
      id: t.id,
      title: t.title.trim(),
      priority: t.priority,
      date: t.date,
      done: t.done,
      duration: t.duration,
      start: t.start,
    };
  });
  return { version: 1, tasks };
}
export function timeLabel(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function overlaps(tasks, candidate) {
  return (
    candidate.start !== null &&
    tasks.some(
      (t) =>
        t.id !== candidate.id &&
        t.date === candidate.date &&
        t.start !== null &&
        candidate.start < t.start + t.duration &&
        candidate.start + candidate.duration > t.start,
    )
  );
}
export function shiftDate(value, delta) {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return localDate(d);
}
