import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Sun,
  SunMedium,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings2,
  ArrowUpRight,
  Flag,
  Clock3,
  MoreHorizontal,
  Check,
  X,
  Play,
  Pause,
  RotateCcw,
  Leaf,
  Download,
  Upload,
  Pencil,
  Trash2,
  LayoutList,
  CheckCheck,
  Coffee,
  Volume2,
  VolumeX,
  AlertCircle,
} from "lucide-react";
import {
  localDate,
  shiftDate,
  timeLabel,
  overlaps,
  validateData,
} from "../shared/model.js";
import "./styles.css";

const priorityNames = { high: "重点", normal: "普通", later: "稍后" };
const api = window.daylight;
function App() {
  const [data, setData] = useState({ version: 1, tasks: [] });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [date, setDate] = useState(localDate());
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [settings, setSettings] = useState(false);
  const [toast, setToast] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [endAt, setEndAt] = useState(null);
  const [muted, setMuted] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [showDone, setShowDone] = useState(true);
  const [busy, setBusy] = useState(false);
  const dataRef = useRef(data);
  const revision = useRef(0);
  const soundRef = useRef(null);
  const today = localDate(new Date(now));
  useEffect(() => {
    api
      .load()
      .then((result) => {
        dataRef.current = result.data;
        setData(result.data);
        setReady(true);
        if (result.warning) setToast(result.warning);
      })
      .catch((e) => setLoadError(e.message));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!endAt) return;
    const left = Math.max(0, Math.ceil((endAt - now) / 1000));
    setRemaining(left);
    if (left === 0) {
      setEndAt(null);
      setToast("专注结束。站起来走走，给自己一点休息。");
      if (!muted && soundRef.current) {
        const ctx = soundRef.current;
        for (let i = 0; i < 2; i++) {
          const oscillator = ctx.createOscillator(),
            gain = ctx.createGain();
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.frequency.value = i ? 660 : 520;
          gain.gain.setValueAtTime(0.07, ctx.currentTime + i * 0.3);
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + i * 0.3 + 0.5,
          );
          oscillator.start(ctx.currentTime + i * 0.3);
          oscillator.stop(ctx.currentTime + i * 0.3 + 0.5);
        }
      }
    }
  }, [now, endAt, muted]);
  async function persist(next = dataRef.current) {
    const token = ++revision.current;
    dataRef.current = next;
    setData(next);
    setSaving(true);
    try {
      await api.save(next);
      if (revision.current === token) setSaveError("");
    } catch {
      if (revision.current === token)
        setSaveError("保存失败，当前更改尚未写入磁盘。请重试。");
    } finally {
      if (revision.current === token) setSaving(false);
    }
  }
  function updateTask(task) {
    persist({
      ...dataRef.current,
      tasks: dataRef.current.tasks.map((t) => (t.id === task.id ? task : t)),
    });
  }
  function toggleDone(task) {
    updateTask({ ...task, done: !task.done });
    if (task.id === focusId && !task.done) {
      setEndAt(null);
      setFocusId(null);
      setRemaining(focusMinutes * 60);
    }
  }
  function openNew(start = null) {
    setModal({
      id: crypto.randomUUID(),
      title: "",
      priority: "normal",
      date,
      duration: 30,
      start,
      done: false,
      isNew: true,
    });
  }
  useEffect(() => {
    function key(e) {
      if (e.key === "Escape") {
        setModal(null);
        setSettings(false);
        setDeleteId(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (ready) openNew();
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [date, ready]);
  function chooseFocus(task) {
    setFocusId(task.id);
    setEndAt(null);
    setRemaining(focusMinutes * 60);
    setToast(`已选择「${task.title}」，准备好后开始专注。`);
  }
  function playPause() {
    if (endAt) {
      setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
      setEndAt(null);
    } else {
      if (!soundRef.current) soundRef.current = new AudioContext();
      soundRef.current.resume();
      const secs = remaining || focusMinutes * 60;
      setRemaining(secs);
      setEndAt(Date.now() + secs * 1000);
    }
  }
  const tasks = data.tasks.filter((t) => t.date === date);
  const completed = tasks.filter((t) => t.done).length;
  const high = tasks.filter((t) => t.priority === "high" && !t.done).length;
  const plannedMinutes = tasks
    .filter((t) => t.start !== null)
    .reduce((a, t) => a + t.duration, 0);
  const shown = tasks
    .filter(
      (t) =>
        (filter === "all" || t.priority === filter) && (showDone || !t.done),
    )
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        ["high", "normal", "later"].indexOf(a.priority) -
          ["high", "normal", "later"].indexOf(b.priority),
    );
  const blocks = tasks
    .filter((t) => t.start !== null)
    .sort((a, b) => a.start - b.start);
  const focusTask = data.tasks.find((t) => t.id === focusId && !t.done);
  const dateObj = new Date(`${date}T12:00:00`);
  const firstHour = Math.min(8, ...blocks.map((t) => Math.floor(t.start / 60)));
  const lastHour = Math.max(
    19,
    ...blocks.map((t) => Math.ceil((t.start + t.duration) / 60)),
  );
  const hours = Array.from(
    { length: lastHour - firstHour + 1 },
    (_, i) => i + firstHour,
  );
  const dayMinutes = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  if (!ready)
    return (
      <>
        <div className="titlebar">
          <Sun size={14} /> DAYLIGHT
        </div>
        <div className="loading">
          <Sun size={32} />
          <h2>{loadError ? "暂时无法打开任务" : "让今天，从容开始。"}</h2>
          <p>{loadError || "正在读取本机数据…"}</p>
          {loadError && (
            <button onClick={() => setSettings(true)}>导入备份</button>
          )}
        </div>
        {settings && (
          <SettingsPanel
            onClose={() => setSettings(false)}
            onImport={async () => {
              try {
                const next = await api.importData();
                if (next) {
                  setData(next);
                  dataRef.current = next;
                  setReady(true);
                  setLoadError("");
                  setSettings(false);
                }
              } catch (e) {
                setLoadError(e.message);
              }
            }}
            onExport={async () => {
              try {
                await api.exportData();
              } catch (e) {
                setLoadError(e.message);
              }
            }}
          />
        )}
      </>
    );
  return (
    <>
      <div className="titlebar">
        <Sun size={14} /> DAYLIGHT <span>把时间，留给重要的事</span>
      </div>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <img src="./daylight.svg" alt="" />
            <div>
              今日<span>DAYLIGHT</span>
            </div>
          </div>
          <div className="workspace-label">我的空间</div>
          <button
            className="nav-item active"
            onClick={() => {
              setDate(today);
              setFilter("all");
            }}
          >
            <SunMedium size={19} /> 我的一天{" "}
            <span>
              {data.tasks.filter((t) => t.date === today && !t.done).length}
            </span>
          </button>
          <button
            className="nav-item"
            onClick={() => {
              setFilter("all");
              document
                .getElementById("plan-heading")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <CalendarDays size={18} /> 时间安排 <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-note">
            <Leaf size={23} />
            <p>
              少一点忙碌，
              <br />
              多一点有序。
            </p>
            <span>一次，只做好一件事。</span>
          </div>
          <div className="sidebar-bottom">
            <button onClick={() => setSettings(true)}>
              <Settings2 size={17} /> 设置与备份
            </button>
            <span className="local-status">
              <i />{" "}
              {saving
                ? "正在保存…"
                : saveError
                  ? "有更改未保存"
                  : "数据已保存在本机"}
            </span>
          </div>
        </aside>
        <main>
          <header className="page-header">
            <div className="eyebrow">MAKE ROOM FOR WHAT MATTERS</div>
            <div className="heading-row">
              <div>
                <h1>
                  {date === today
                    ? "把今天，过得从容一点"
                    : "为这一天，留一点余地"}
                  <span>☀</span>
                </h1>
                <p>不必填满每一分钟。选好重点，然后开始。</p>
              </div>
              <button className="primary" onClick={() => openNew()}>
                <Plus size={17} /> 新建任务 <kbd>Ctrl N</kbd>
              </button>
            </div>
            <div className="date-row">
              <div className="date-picker">
                <button
                  className="icon-button"
                  aria-label="前一天"
                  onClick={() => setDate(shiftDate(date, -1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <label className="date-label">
                  <CalendarDays size={16} />
                  <span>
                    {dateObj.getMonth() + 1} 月 {dateObj.getDate()} 日{" "}
                    <em>
                      {dateObj.toLocaleDateString("zh-CN", { weekday: "long" })}
                    </em>
                  </span>
                  <input
                    aria-label="选择日期"
                    type="date"
                    value={date}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label="后一天"
                  onClick={() => setDate(shiftDate(date, 1))}
                >
                  <ChevronRight size={16} />
                </button>
                {date !== today && (
                  <button
                    className="today-button"
                    onClick={() => setDate(today)}
                  >
                    回到今天
                  </button>
                )}
              </div>
              <span className="date-hint">
                {completed === tasks.length && tasks.length
                  ? "今天的努力，值得一个小小的庆祝。"
                  : "慢慢来，也是一种向前。"}
              </span>
            </div>
          </header>
          {saveError && (
            <div className="error-banner">
              <AlertCircle size={16} />
              {saveError}
              <button onClick={() => persist()}>重新保存</button>
            </div>
          )}
          <section className="stats" aria-label="当日概览">
            <div>
              <span className="stat-icon green">
                <CheckCheck size={20} />
              </span>
              <div>
                <span>已完成</span>
                <strong>
                  {completed}
                  <small> / {tasks.length}</small>
                </strong>
              </div>
              <div className="progress-track">
                <i
                  style={{
                    width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <span className="stat-icon peach">
                <Flag size={19} />
              </span>
              <div>
                <span>待办重点</span>
                <strong>
                  {high}
                  <small> 个任务</small>
                </strong>
              </div>
              <span className="stat-detail">
                {high > 3 ? "试着只保留 3 个重点" : "给重要的事，优先的位置"}
              </span>
            </div>
            <div>
              <span className="stat-icon blue">
                <Clock3 size={19} />
              </span>
              <div>
                <span>已安排时间</span>
                <strong>
                  {Math.floor(plannedMinutes / 60)}
                  <small> 小时 {plannedMinutes % 60} 分</small>
                </strong>
              </div>
              <span className="stat-detail">也记得留出休息的空白</span>
            </div>
          </section>
          <div className="content-grid">
            <section className="task-panel">
              <div className="section-heading">
                <h2>
                  <LayoutList size={18} /> 我的任务 <span>{tasks.length}</span>
                </h2>
                <button
                  className="text-button"
                  onClick={() => setShowDone(!showDone)}
                >
                  {showDone ? "隐藏已完成" : "显示已完成"}
                </button>
              </div>
              <div className="filters">
                {[
                  ["all", "全部"],
                  ["high", "重点"],
                  ["normal", "普通"],
                  ["later", "稍后"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={filter === key ? "selected" : ""}
                  >
                    {key === "high" && <i />}
                    {label}
                  </button>
                ))}
              </div>
              <div className="task-list">
                {shown.map((task) => (
                  <article
                    key={task.id}
                    className={`task-card ${task.done ? "completed" : ""} ${focusTask?.id === task.id ? "focusing" : ""}`}
                  >
                    <button
                      className="checkbox"
                      aria-label={`${task.done ? "恢复" : "完成"}任务 ${task.title}`}
                      onClick={() => toggleDone(task)}
                    >
                      {task.done && <Check size={13} />}
                    </button>
                    <div className="task-content">
                      <button
                        className="task-title"
                        onClick={() => setModal(task)}
                      >
                        {task.title}
                      </button>
                      <div className="task-meta">
                        <span className={`priority ${task.priority}`}>
                          <i />
                          {priorityNames[task.priority]}
                        </span>
                        <span>
                          <Clock3 size={12} />
                          {task.duration} 分钟
                        </span>
                        {task.start !== null && (
                          <span className="scheduled">
                            {timeLabel(task.start)}–
                            {timeLabel(task.start + task.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="task-actions">
                      {!task.done && (
                        <button
                          className="icon-button"
                          aria-label={`专注 ${task.title}`}
                          title="选择为专注任务"
                          onClick={() => chooseFocus(task)}
                        >
                          <Play size={15} />
                        </button>
                      )}
                      <button
                        className="icon-button"
                        aria-label={`编辑 ${task.title}`}
                        title="编辑任务"
                        onClick={() => setModal(task)}
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </article>
                ))}
                {!shown.length && (
                  <div className="empty">
                    <span>
                      <Leaf size={26} />
                    </span>
                    <h3>
                      {tasks.length
                        ? "这里暂时没有任务"
                        : "给今天一个轻轻的开始"}
                    </h3>
                    <p>
                      {tasks.length
                        ? "试试其他优先级，或添加一件小事。"
                        : "写下一件想完成的事，再给它留一点时间。"}
                    </p>
                    <button className="text-button" onClick={() => openNew()}>
                      <Plus size={15} /> 添加第一个任务
                    </button>
                  </div>
                )}
              </div>
              <button className="add-task" onClick={() => openNew()}>
                <Plus size={17} /> 添加任务<span>留下一件想做的事</span>
              </button>
              <div className="focus-card">
                <div className="focus-top">
                  <span>
                    <span className={`focus-dot ${endAt ? "pulsing" : ""}`} />{" "}
                    专注时刻
                  </span>
                  <button
                    className="icon-button"
                    aria-label={muted ? "开启提示音" : "静音提示音"}
                    onClick={() => setMuted(!muted)}
                  >
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                </div>
                <p className="focus-title">
                  {focusTask ? focusTask.title : "留一段时间，给眼前这一件事"}
                </p>
                <div className="timer">
                  {String(Math.floor(remaining / 60)).padStart(2, "0")}
                  <span>:</span>
                  {String(remaining % 60).padStart(2, "0")}
                </div>
                <div className="focus-controls">
                  <div className="duration-toggle">
                    {[25, 50].map((n) => (
                      <button
                        key={n}
                        disabled={Boolean(endAt)}
                        className={focusMinutes === n ? "selected" : ""}
                        onClick={() => {
                          setFocusMinutes(n);
                          setRemaining(n * 60);
                        }}
                      >
                        {n} 分钟
                      </button>
                    ))}
                  </div>
                  <button
                    className="icon-button reset"
                    aria-label="重置专注计时"
                    onClick={() => {
                      setEndAt(null);
                      setRemaining(focusMinutes * 60);
                    }}
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button className="focus-start" onClick={playPause}>
                    {endAt ? <Pause size={14} /> : <Play size={14} />}
                    {endAt
                      ? "暂停"
                      : remaining === 0
                        ? "再来一轮"
                        : remaining < focusMinutes * 60
                          ? "继续"
                          : "开始专注"}
                  </button>
                </div>
                {focusTask && (
                  <button
                    className="finish-focus"
                    onClick={() => toggleDone(focusTask)}
                  >
                    <Check size={13} /> 完成这项任务
                  </button>
                )}
              </div>
              <p className="small-note">
                <Coffee size={14} /> 专注之后，也给自己一点休息。
              </p>
            </section>
            <section className="schedule-panel">
              <div className="section-heading">
                <h2 id="plan-heading">
                  <CalendarDays size={18} /> 时间安排
                </h2>
                <span className="schedule-zone">本地时间</span>
              </div>
              <div className="schedule-tip">
                <i /> 点击空白时段，为任务留出时间
              </div>
              <div className="timeline-scroll">
                <div
                  className="timeline"
                  style={{ height: (lastHour - firstHour) * 76 + 30 }}
                >
                  {hours.map((hour) => (
                    <div
                      className="hour-row"
                      key={hour}
                      style={{ top: (hour - firstHour) * 76 }}
                    >
                      <span>{timeLabel(hour * 60)}</span>
                      {hour < lastHour && (
                        <button
                          aria-label={`安排 ${timeLabel(hour * 60)} 的任务`}
                          onClick={() => openNew(hour * 60)}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {blocks.map((task) => (
                    <button
                      key={task.id}
                      className={`time-block ${task.priority} ${task.done ? "done" : ""}`}
                      style={{
                        top: (task.start / 60 - firstHour) * 76 + 1,
                        height: Math.max((task.duration / 60) * 76 - 2, 20),
                      }}
                      onClick={() => setModal(task)}
                      title={`${task.title} ${timeLabel(task.start)}–${timeLabel(task.start + task.duration)}`}
                    >
                      <span className="block-title">
                        {task.done && <Check size={12} />}
                        {task.title}
                      </span>
                      {task.duration >= 30 && (
                        <span className="block-time">
                          {timeLabel(task.start)} —{" "}
                          {timeLabel(task.start + task.duration)}
                        </span>
                      )}
                    </button>
                  ))}
                  {date === today &&
                    dayMinutes >= firstHour * 60 &&
                    dayMinutes <= lastHour * 60 && (
                      <div
                        className="now-line"
                        style={{ top: (dayMinutes / 60 - firstHour) * 76 }}
                      >
                        <span>{timeLabel(dayMinutes)}</span>
                        <i />
                      </div>
                    )}
                  {!blocks.length && (
                    <div className="timeline-empty">
                      <Sun size={26} />
                      <span>一天的留白，等你安排</span>
                      <small>从一个时间区块开始</small>
                    </div>
                  )}
                </div>
              </div>
              <div className="schedule-footer">
                <span>
                  <i className="green-dot" /> 已安排 {blocks.length} 个时间区块
                </span>
                <span>留白也是计划的一部分</span>
              </div>
            </section>
          </div>
          <footer className="page-footer">
            <span>一点点进展，也是美好的一天。</span>
            <span>DAYLIGHT · 简单，有序，专注</span>
          </footer>
        </main>
      </div>
      {modal && (
        <TaskModal
          task={modal}
          tasks={data.tasks}
          onClose={() => setModal(null)}
          onDelete={() => {
            setDeleteId(modal.id);
            setModal(null);
          }}
          onSave={(task) => {
            const next = modal.isNew
              ? [...dataRef.current.tasks, task]
              : dataRef.current.tasks.map((t) => (t.id === task.id ? task : t));
            persist(validateData({ version: 1, tasks: next }));
            setModal(null);
          }}
        />
      )}
      {settings && (
        <SettingsPanel
          onClose={() => setSettings(false)}
          busy={busy}
          onExport={async () => {
            setBusy(true);
            try {
              if (saveError)
                throw new Error("请先重新保存当前更改，再导出备份。");
              if (await api.exportData()) setToast("任务备份已导出");
            } catch (e) {
              setToast(e.message);
            } finally {
              setBusy(false);
            }
          }}
          onImport={async () => {
            setBusy(true);
            try {
              const next = await api.importData();
              if (next) {
                dataRef.current = next;
                setData(next);
                setSaveError("");
                setFocusId(null);
                setEndAt(null);
                setRemaining(focusMinutes * 60);
                setToast("备份已导入");
                setSettings(false);
              }
            } catch (e) {
              setToast(`导入失败：${e.message}`);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {deleteId && (
        <Modal onClose={() => setDeleteId(null)}>
          <div className="dialog-header">
            <h2>删除这项任务？</h2>
            <button
              className="icon-button"
              aria-label="关闭"
              onClick={() => setDeleteId(null)}
            >
              <X size={18} />
            </button>
          </div>
          <p className="dialog-description">
            「{data.tasks.find((t) => t.id === deleteId)?.title}」将被删除。
          </p>
          <div className="dialog-footer">
            <button className="secondary" onClick={() => setDeleteId(null)}>
              保留任务
            </button>
            <button
              className="danger"
              onClick={() => {
                persist({
                  ...dataRef.current,
                  tasks: dataRef.current.tasks.filter((t) => t.id !== deleteId),
                });
                if (focusId === deleteId) {
                  setFocusId(null);
                  setEndAt(null);
                  setRemaining(focusMinutes * 60);
                }
                setDeleteId(null);
              }}
            >
              删除任务
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
function Modal({ children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const root = ref.current;
    const nodes = () => [
      ...root.querySelectorAll(
        'button:not([disabled]), input, select, [tabindex="0"]',
      ),
    ];
    (root.querySelector("input") || nodes()[0])?.focus();
    function trap(e) {
      if (e.key !== "Tab") return;
      const items = nodes();
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault();
        items.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
        e.preventDefault();
        items[0]?.focus();
      }
    }
    root.addEventListener("keydown", trap);
    return () => {
      root.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="任务与设置"
        ref={ref}
      >
        {children}
      </section>
    </div>
  );
}
function TaskModal({ task, tasks, onSave, onClose, onDelete }) {
  const [draft, setDraft] = useState({ ...task });
  const [error, setError] = useState("");
  function patch(value) {
    setDraft((t) => ({ ...t, ...value }));
    setError("");
  }
  function submit(e) {
    e.preventDefault();
    try {
      const clean = validateData({ version: 1, tasks: [draft] }).tasks[0];
      if (overlaps(tasks, clean))
        throw new Error("这个时间段已有安排，请调整开始时间或时长。");
      onSave(clean);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog-header">
          <div>
            <div className="eyebrow">A LITTLE STEP FORWARD</div>
            <h2>{task.isNew ? "留下一件想做的事" : "调整这项任务"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <label className="field">
          任务名称
          <input
            autoFocus
            required
            maxLength={200}
            placeholder="例如：读完书的一个章节"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <div className="field">
          <span>优先级</span>
          <div className="priority-choices">
            {Object.entries(priorityNames).map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={`${key} ${draft.priority === key ? "selected" : ""}`}
                onClick={() => patch({ priority: key })}
              >
                <Flag size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            日期
            <input
              type="date"
              required
              value={draft.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </label>
          <label className="field">
            预计时长（分钟）
            <input
              type="number"
              required
              min={5}
              max={480}
              step={5}
              value={draft.duration}
              onChange={(e) => patch({ duration: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="schedule-check">
          <input
            type="checkbox"
            checked={draft.start !== null}
            onChange={(e) => patch({ start: e.target.checked ? 9 * 60 : null })}
          />
          安排一个时间区块<span>也可以稍后再安排</span>
        </label>
        {draft.start !== null && (
          <label className="field">
            开始时间
            <input
              type="time"
              required
              step={300}
              value={timeLabel(draft.start)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                patch({ start: h * 60 + m });
              }}
            />
            <span className="field-help">
              结束时间：{timeLabel(draft.start + draft.duration)}
            </span>
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          {!task.isNew && (
            <button type="button" className="delete-button" onClick={onDelete}>
              <Trash2 size={15} /> 删除
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary">
            {task.isNew ? "添加任务" : "保存更改"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function SettingsPanel({ onClose, onExport, onImport, busy }) {
  return (
    <Modal onClose={onClose}>
      <div className="dialog-header">
        <h2>设置与备份</h2>
        <button className="icon-button" aria-label="关闭" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="settings-about">
        <img src="./daylight.svg" alt="" />
        <div>
          <strong>今日 · Daylight</strong>
          <span>v0.1.0 · 为从容的一天留出空间</span>
        </div>
      </div>
      <p className="dialog-description">
        任务仅存储在这台电脑上，无需注册。导出 JSON
        备份后，可以在另一台电脑上导入。
      </p>
      <button className="settings-action" onClick={onExport} disabled={busy}>
        <Download size={19} />
        <div>
          <strong>导出任务备份</strong>
          <span>保存所有日期的任务</span>
        </div>
        <ArrowUpRight size={16} />
      </button>
      <button className="settings-action" onClick={onImport} disabled={busy}>
        <Upload size={19} />
        <div>
          <strong>导入任务备份</strong>
          <span>替换前会确认，并备份现有数据</span>
        </div>
        <ArrowUpRight size={16} />
      </button>
      <div className="settings-foot">
        快捷键 <kbd>Ctrl N</kbd> 新建任务 <kbd>Esc</kbd> 关闭弹窗
      </div>
    </Modal>
  );
}
createRoot(document.getElementById("root")).render(<App />);
