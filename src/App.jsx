import { useState, useEffect } from "react";

// ─── Constants ───────────────────────────────────────────────
const KOJI_STATUS = ["準備中", "施工中", "完了", "一時停止"];
const TASK_STATUS = ["未着手", "進行中", "完了"];
const TASK_PRIORITY = ["高", "中", "低"];
const SHOKUSHU_LIST = ["基礎工事","大工","電気工事","給排水","左官","塗装","内装","外装","解体","土工","鉄筋","型枠","鉄骨","設備","その他"];

const KOJI_STATUS_STYLE = {
  "準備中":  { bg: "#1e293b", text: "#94a3b8", dot: "#64748b" },
  "施工中":  { bg: "#1c3a1c", text: "#4ade80", dot: "#22c55e" },
  "完了":    { bg: "#1e2a3a", text: "#60a5fa", dot: "#3b82f6" },
  "一時停止":{ bg: "#2a1a0e", text: "#fb923c", dot: "#f97316" },
};
const TASK_STATUS_STYLE = {
  "未着手": { color: "#64748b", border: "#334155" },
  "進行中": { color: "#f59e0b", border: "#d97706" },
  "完了":   { color: "#22c55e", border: "#16a34a" },
};
const PRIORITY_COLOR = { "高": "#ef4444", "中": "#f59e0b", "低": "#64748b" };

const GIST_SETTINGS_KEY = "koji_gist_settings";

const C = {
  bg: "#060a0f", card: "#0c1117", border: "#1a2332",
  text: "#e2e8f0", muted: "#4a5568", accent: "#f59e0b", accent2: "#0ea5e9",
};

// ─── Utils ────────────────────────────────────────────────────
function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) { if (!d) return ""; const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}`; }
function fmtDateFull(d) { if (!d) return ""; const dt = new Date(d); return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}`; }
function daysLeft(end) { if (!end) return null; return Math.ceil((new Date(end) - new Date()) / 86400000); }

function loadData(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function saveData(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── Gist Sync ───────────────────────────────────────────────
function loadGistSettings() {
  try { return JSON.parse(localStorage.getItem(GIST_SETTINGS_KEY)) || {}; } catch { return {}; }
}
function saveGistSettings(settings) {
  localStorage.setItem(GIST_SETTINGS_KEY, JSON.stringify(settings));
}

async function syncToGist(kojis, schedules) {
  const { token, gistId } = loadGistSettings();
  if (!token || !gistId) throw new Error("Gist設定が未入力です");

  const payload = {
    updatedAt: new Date().toISOString(),
    kojis: kojis.map(k => ({
      id: k.id, name: k.name, start: k.start, end: k.end, status: k.status,
    })),
    schedules: schedules.map(s => ({
      id: s.id, kojiId: s.kojiId, title: s.title,
      date: s.date, startTime: s.startTime, endTime: s.endTime, memo: s.memo || "",
    })),
  };

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: { "koji-schedules.json": { content: JSON.stringify(payload, null, 2) } },
    }),
  });

  if (!res.ok) throw new Error(`Gist更新失敗: ${res.status}`);
  return await res.json();
}

// ─── ICS Export ───────────────────────────────────────────────
function toICSDate(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr || "00:00"}:00`);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function exportICS(schedules, kojiName) {
  const uid = () => Math.random().toString(36).slice(2) + "@kojimanager";
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const events = schedules.map(s => `BEGIN:VEVENT
UID:${uid()}
DTSTAMP:${now}
DTSTART:${toICSDate(s.date, s.startTime)}
DTEND:${toICSDate(s.date, s.endTime)}
SUMMARY:${s.title}${kojiName ? ` (${kojiName})` : ""}
DESCRIPTION:${s.memo || ""}
END:VEVENT`).join("\n");

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//施工管理//JP
CALSCALE:GREGORIAN
METHOD:PUBLISH
${events}
END:VCALENDAR`;

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${kojiName || "schedule"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── UI Atoms ─────────────────────────────────────────────────
function Btn({ children, variant = "default", onClick, style = {}, disabled }) {
  const styles = {
    default: { bg: "#1a2332", color: C.text, border: "1px solid #2d3748" },
    primary: { bg: C.accent, color: "#000", border: "none" },
    ghost:   { bg: "transparent", color: C.muted, border: "1px solid #2d3748" },
    danger:  { bg: "transparent", color: "#ef4444", border: "1px solid #ef444433" },
    blue:    { bg: "#0ea5e9", color: "#000", border: "none" },
    green:   { bg: "#22c55e", color: "#000", border: "none" },
  };
  const s = styles[variant] || styles.default;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: s.bg, color: s.color, border: s.border,
      borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      fontFamily: "'Noto Sans JP', sans-serif", whiteSpace: "nowrap",
      transition: "opacity 0.15s", ...style,
    }}>{children}</button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontSize: "11px", color: C.muted, fontWeight: 700, marginBottom: "5px", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      {children}
    </div>
  );
}

function Input(props) {
  return <input {...props} style={{
    width: "100%", background: "#0c1117", border: `1px solid ${C.border}`,
    borderRadius: "8px", padding: "10px 12px", color: C.text, fontSize: "14px",
    outline: "none", boxSizing: "border-box", fontFamily: "'Noto Sans JP', sans-serif",
    ...props.style,
  }} />;
}

function Select({ options, ...props }) {
  return (
    <select {...props} style={{
      width: "100%", background: "#0c1117", border: `1px solid ${C.border}`,
      borderRadius: "8px", padding: "10px 12px", color: C.text, fontSize: "14px",
      outline: "none", boxSizing: "border-box", fontFamily: "'Noto Sans JP', sans-serif",
      ...props.style,
    }}>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}

function Textarea(props) {
  return <textarea {...props} style={{
    width: "100%", background: "#0c1117", border: `1px solid ${C.border}`,
    borderRadius: "8px", padding: "10px 12px", color: C.text, fontSize: "14px",
    outline: "none", boxSizing: "border-box", fontFamily: "'Noto Sans JP', sans-serif",
    resize: "vertical", minHeight: "72px", ...props.style,
  }} />;
}

function Modal({ onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }} onClick={onClose}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px",
        padding: "24px", width: "100%", maxWidth: wide ? "640px" : "480px",
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
      }} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
      <div style={{ fontSize: "16px", fontWeight: 700, color: C.text }}>{title}</div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "22px", lineHeight: 1 }}>×</button>
    </div>
  );
}

function StatusDot({ status }) {
  const s = KOJI_STATUS_STYLE[status] || KOJI_STATUS_STYLE["準備中"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: s.bg, color: s.text, borderRadius: "5px", padding: "3px 8px", fontSize: "11px", fontWeight: 700 }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {status}
    </span>
  );
}

function ProgressBar({ done, total, color = C.accent }) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <div style={{ height: "4px", background: "#1a2332", borderRadius: "2px" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "2px", transition: "width 0.4s" }} />
    </div>
  );
}

// ─── Forms ────────────────────────────────────────────────────
function KojiForm({ initial, contractors, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", start: today(), end: "", status: "準備中", memo: "", contractorIds: [] });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggleC = id => set("contractorIds", f.contractorIds.includes(id) ? f.contractorIds.filter(x => x !== id) : [...f.contractorIds, id]);

  return (
    <Modal onClose={onClose} wide>
      <ModalHeader title={initial ? "工事を編集" : "工事を新規登録"} onClose={onClose} />
      <Field label="工事名"><Input value={f.name} onChange={e => set("name", e.target.value)} placeholder="〇〇新築工事" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="ステータス"><Select value={f.status} onChange={e => set("status", e.target.value)} options={KOJI_STATUS} /></Field>
        <div />
        <Field label="着工日"><Input type="date" value={f.start} onChange={e => set("start", e.target.value)} /></Field>
        <Field label="竣工予定日"><Input type="date" value={f.end} onChange={e => set("end", e.target.value)} /></Field>
      </div>
      <Field label="担当施工業者">
        {contractors.length === 0
          ? <div style={{ fontSize: "13px", color: C.muted }}>業者が登録されていません</div>
          : <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {contractors.map(c => {
                const on = f.contractorIds.includes(c.id);
                return <button key={c.id} onClick={() => toggleC(c.id)} style={{
                  padding: "5px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: 600,
                  background: on ? C.accent + "22" : "#1a2332", color: on ? C.accent : C.muted,
                  border: `1px solid ${on ? C.accent : "#2d3748"}`, fontFamily: "'Noto Sans JP', sans-serif",
                }}>{c.name}</button>;
              })}
            </div>
        }
      </Field>
      <Field label="備考"><Textarea value={f.memo} onChange={e => set("memo", e.target.value)} /></Field>
      <Btn variant="primary" onClick={() => f.name && onSave(f)} style={{ width: "100%", padding: "12px", fontSize: "14px" }}>保存する</Btn>
    </Modal>
  );
}

function ContractorForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", shokushu: "大工", contact: "", manager: "", memo: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Modal onClose={onClose}>
      <ModalHeader title={initial ? "業者を編集" : "業者を新規登録"} onClose={onClose} />
      <Field label="業者名"><Input value={f.name} onChange={e => set("name", e.target.value)} placeholder="〇〇建設" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="職種"><Select value={f.shokushu} onChange={e => set("shokushu", e.target.value)} options={SHOKUSHU_LIST} /></Field>
        <Field label="担当者名"><Input value={f.manager} onChange={e => set("manager", e.target.value)} placeholder="山田 太郎" /></Field>
      </div>
      <Field label="連絡先（電話/メール）"><Input value={f.contact} onChange={e => set("contact", e.target.value)} placeholder="090-0000-0000" /></Field>
      <Field label="備考"><Textarea value={f.memo} onChange={e => set("memo", e.target.value)} /></Field>
      <Btn variant="blue" onClick={() => f.name && onSave(f)} style={{ width: "100%", padding: "12px", fontSize: "14px" }}>保存する</Btn>
    </Modal>
  );
}

function TaskForm({ initial, contractors, onSave, onClose }) {
  const [f, setF] = useState(initial || { title: "", contractorId: "", priority: "中", status: "未着手", due: "", memo: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const cOpts = [{ value: "", label: "（担当なし）" }, ...contractors.map(c => ({ value: c.id, label: c.name }))];
  return (
    <Modal onClose={onClose}>
      <ModalHeader title={initial ? "タスクを編集" : "タスクを追加"} onClose={onClose} />
      <Field label="タスク名"><Input value={f.title} onChange={e => set("title", e.target.value)} placeholder="何をする？" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="担当業者"><Select value={f.contractorId} onChange={e => set("contractorId", e.target.value)} options={cOpts} /></Field>
        <Field label="優先度"><Select value={f.priority} onChange={e => set("priority", e.target.value)} options={TASK_PRIORITY} /></Field>
        <Field label="ステータス"><Select value={f.status} onChange={e => set("status", e.target.value)} options={TASK_STATUS} /></Field>
        <Field label="期限"><Input type="date" value={f.due} onChange={e => set("due", e.target.value)} /></Field>
      </div>
      <Field label="備考"><Textarea value={f.memo} onChange={e => set("memo", e.target.value)} /></Field>
      <Btn variant="primary" onClick={() => f.title && onSave(f)} style={{ width: "100%", padding: "12px", fontSize: "14px" }}>保存する</Btn>
    </Modal>
  );
}

function SchedForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { title: "", date: today(), startTime: "08:00", endTime: "17:00", memo: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Modal onClose={onClose}>
      <ModalHeader title={initial ? "予定を編集" : "予定を追加"} onClose={onClose} />
      <Field label="内容"><Input value={f.title} onChange={e => set("title", e.target.value)} placeholder="基礎コンクリート打設..." /></Field>
      <Field label="日付"><Input type="date" value={f.date} onChange={e => set("date", e.target.value)} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="開始"><Input type="time" value={f.startTime} onChange={e => set("startTime", e.target.value)} /></Field>
        <Field label="終了"><Input type="time" value={f.endTime} onChange={e => set("endTime", e.target.value)} /></Field>
      </div>
      <Field label="備考"><Textarea value={f.memo} onChange={e => set("memo", e.target.value)} /></Field>
      <Btn variant="primary" onClick={() => f.title && onSave(f)} style={{ width: "100%", padding: "12px", fontSize: "14px" }}>保存する</Btn>
    </Modal>
  );
}

// ─── Koji Detail ──────────────────────────────────────────────
function KojiDetail({ koji, contractors, tasks, schedules, onBack, onEditKoji, onAddTask, onEditTask, onDeleteTask, onStatusTask, onAddSched, onEditSched, onDeleteSched }) {
  const [detailTab, setDetailTab] = useState("tasks");
  const kojiContractors = contractors.filter(c => koji.contractorIds?.includes(c.id));
  const kojiTasks = tasks.filter(t => t.kojiId === koji.id);
  const kojiSchedules = schedules.filter(s => s.kojiId === koji.id).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const doneTasks = kojiTasks.filter(t => t.status === "完了").length;
  const days = daysLeft(koji.end);

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "13px", fontWeight: 700, padding: "0 0 16px", fontFamily: "'Noto Sans JP', sans-serif" }}>
        ← 工事一覧に戻る
      </button>

      {/* Header card */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
          <div>
            <div style={{ fontSize: "11px", color: C.muted, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "4px" }}>工事番号 {String(koji.id).slice(-6)}</div>
            <div style={{ fontSize: "20px", fontWeight: 900, color: C.text, lineHeight: 1.2 }}>{koji.name}</div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <StatusDot status={koji.status} />
            <Btn variant="ghost" onClick={onEditKoji} style={{ padding: "4px 10px", fontSize: "12px" }}>編集</Btn>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "14px" }}>
          {[
            ["📅 着工", fmtDateFull(koji.start)],
            ["🏁 竣工予定", koji.end ? `${fmtDateFull(koji.end)}${days !== null ? (days < 0 ? ` (${Math.abs(days)}日超過)` : ` (残${days}日)`) : ""}` : "—"],
          ].map(([l, v]) => (
            <div key={l} style={{ background: "#070c12", borderRadius: "8px", padding: "10px 12px" }}>
              <div style={{ fontSize: "11px", color: C.muted, marginBottom: "3px" }}>{l}</div>
              <div style={{ fontSize: "13px", color: l === "🏁 竣工予定" && days < 0 ? "#ef4444" : C.text, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: C.muted, marginBottom: "5px" }}>
            <span>タスク進捗</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.accent }}>{doneTasks}/{kojiTasks.length}</span>
          </div>
          <ProgressBar done={doneTasks} total={kojiTasks.length} />
        </div>

        {kojiContractors.length > 0 && (
          <div>
            <div style={{ fontSize: "11px", color: C.muted, marginBottom: "6px", fontWeight: 700 }}>施工業者</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {kojiContractors.map(c => (
                <div key={c.id} style={{ background: C.accent + "18", border: `1px solid ${C.accent}44`, borderRadius: "6px", padding: "4px 10px", fontSize: "12px", color: C.accent, fontWeight: 600 }}>
                  {c.name} <span style={{ color: C.muted, fontWeight: 400 }}>({c.shokushu})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sub tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", background: C.card, padding: "4px", borderRadius: "10px", border: `1px solid ${C.border}` }}>
        {["tasks", "schedule"].map(t => (
          <button key={t} onClick={() => setDetailTab(t)} style={{
            flex: 1, padding: "8px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700,
            background: detailTab === t ? C.accent : "transparent",
            color: detailTab === t ? "#000" : C.muted,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}>{t === "tasks" ? "タスク" : "工程スケジュール"}</button>
        ))}
      </div>

      {/* Tasks */}
      {detailTab === "tasks" && (
        <div>
          <Btn variant="ghost" onClick={onAddTask} style={{ width: "100%", marginBottom: "14px", padding: "10px", borderStyle: "dashed" }}>＋ タスクを追加</Btn>
          {kojiTasks.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: "32px", fontSize: "13px" }}>タスクがありません</div>}
          {TASK_STATUS.map(st => {
            const list = kojiTasks.filter(t => t.status === st);
            if (!list.length) return null;
            const ss = TASK_STATUS_STYLE[st];
            return (
              <div key={st} style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ss.border }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: ss.color }}>{st}</span>
                  <span style={{ fontSize: "11px", color: C.muted, background: C.card, borderRadius: "8px", padding: "1px 7px" }}>{list.length}</span>
                </div>
                {list.map(task => {
                  const contractor = contractors.find(c => c.id === task.contractorId);
                  return (
                    <div key={task.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", borderLeft: `3px solid ${ss.border}`, padding: "12px 14px", marginBottom: "7px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: task.status === "完了" ? C.muted : C.text, textDecoration: task.status === "完了" ? "line-through" : "none", marginBottom: "6px" }}>{task.title}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                            {contractor && <span style={{ fontSize: "11px", background: C.accent + "18", color: C.accent, borderRadius: "4px", padding: "2px 7px", fontWeight: 600 }}>{contractor.name}</span>}
                            <span style={{ fontSize: "11px", background: PRIORITY_COLOR[task.priority] + "22", color: PRIORITY_COLOR[task.priority], borderRadius: "4px", padding: "2px 7px", fontWeight: 600 }}>{task.priority}優先</span>
                            {task.due && <span style={{ fontSize: "11px", color: task.due < today() && task.status !== "完了" ? "#ef4444" : C.muted, fontFamily: "'JetBrains Mono', monospace" }}>〆{fmtDate(task.due)}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <Btn variant="ghost" onClick={() => onEditTask(task)} style={{ padding: "4px 8px", fontSize: "11px" }}>編集</Btn>
                          <button onClick={() => onDeleteTask(task.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "16px" }}>×</button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                        {TASK_STATUS.map(s => (
                          <button key={s} onClick={() => onStatusTask(task.id, s)} style={{
                            padding: "3px 8px", borderRadius: "4px", fontSize: "11px", cursor: "pointer",
                            background: task.status === s ? TASK_STATUS_STYLE[s].color + "22" : "transparent",
                            color: task.status === s ? TASK_STATUS_STYLE[s].color : C.muted,
                            border: `1px solid ${task.status === s ? TASK_STATUS_STYLE[s].border : "#1a2332"}`,
                            fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 500,
                          }}>{s}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule */}
      {detailTab === "schedule" && (
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            <Btn variant="ghost" onClick={onAddSched} style={{ flex: 1, padding: "10px", borderStyle: "dashed" }}>＋ 予定を追加</Btn>
            {kojiSchedules.length > 0 && (
              <Btn variant="green" onClick={() => exportICS(kojiSchedules, koji.name)} style={{ padding: "10px 14px", fontSize: "12px" }}>
                📅 .ics書き出し
              </Btn>
            )}
          </div>
          {kojiSchedules.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: "32px", fontSize: "13px" }}>工程予定がありません</div>}

          {/* ICS 説明 */}
          {kojiSchedules.length > 0 && (
            <div style={{ background: "#0a1a0a", border: "1px solid #22c55e33", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px", fontSize: "12px", color: "#4ade80" }}>
              💡 「.ics書き出し」は手動取り込み用。自動同期は☁ Gist同期 → iOSカレンダー照会で実現できます
            </div>
          )}

          {kojiSchedules.map((s, i) => {
            const isToday = s.date === today();
            const isPast = s.date < today();
            return (
              <div key={s.id} style={{ display: "flex", gap: "12px", marginBottom: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "40px", flexShrink: 0 }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: isToday ? C.accent : isPast ? "#22c55e" : C.border, flexShrink: 0 }} />
                  {i < kojiSchedules.length - 1 && <div style={{ width: "2px", flex: 1, background: C.border, marginTop: "4px" }} />}
                </div>
                <div style={{ flex: 1, background: C.card, border: `1px solid ${isToday ? C.accent + "44" : C.border}`, borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: isToday ? C.accent : C.muted, marginBottom: "3px" }}>
                        {fmtDateFull(s.date)} {s.startTime}–{s.endTime}
                        {isToday && <span style={{ marginLeft: "8px", background: C.accent, color: "#000", borderRadius: "3px", padding: "1px 5px", fontSize: "10px", fontWeight: 700 }}>本日</span>}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: isPast ? C.muted : C.text }}>{s.title}</div>
                      {s.memo && <div style={{ fontSize: "12px", color: C.muted, marginTop: "4px" }}>{s.memo}</div>}
                    </div>
                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                      <Btn variant="ghost" onClick={() => onEditSched(s)} style={{ padding: "4px 8px", fontSize: "11px" }}>編集</Btn>
                      <button onClick={() => onDeleteSched(s.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "16px" }}>×</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Koji List ─────────────────────────────────────────────────
function KojiList({ kojis, contractors, tasks, onSelect, onAdd }) {
  const [statusFilter, setStatusFilter] = useState("すべて");
  const filtered = kojis.filter(k => statusFilter === "すべて" || k.status === statusFilter);
  return (
    <div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
        {["すべて", ...KOJI_STATUS].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            background: statusFilter === s ? C.accent : C.card, color: statusFilter === s ? "#000" : C.muted,
            border: `1px solid ${statusFilter === s ? C.accent : C.border}`, fontFamily: "'Noto Sans JP', sans-serif",
          }}>{s}</button>
        ))}
      </div>
      <Btn variant="ghost" onClick={onAdd} style={{ width: "100%", marginBottom: "14px", padding: "12px", borderStyle: "dashed" }}>＋ 工事を新規登録</Btn>
      {filtered.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: "48px", fontSize: "14px" }}>工事がありません</div>}
      {filtered.map(k => {
        const kTasks = tasks.filter(t => t.kojiId === k.id);
        const done = kTasks.filter(t => t.status === "完了").length;
        const kContractors = contractors.filter(c => k.contractorIds?.includes(c.id));
        const days = daysLeft(k.end);
        const overdue = kTasks.filter(t => t.status !== "完了" && t.due && t.due < today()).length;
        return (
          <div key={k.id} onClick={() => onSelect(k.id)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "16px 18px", marginBottom: "10px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "10px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "15px", fontWeight: 800, color: C.text, marginBottom: "4px" }}>{k.name}</div>
              </div>
              <StatusDot status={k.status} />
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
              {k.end && <span style={{ fontSize: "11px", color: days !== null && days < 0 ? "#ef4444" : days !== null && days <= 7 ? "#f59e0b" : C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                🏁 {fmtDateFull(k.end)}{days !== null ? (days < 0 ? ` (${Math.abs(days)}日超過)` : ` (残${days}日)`) : ""}
              </span>}
              {overdue > 0 && <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700 }}>⚠ 期限切れ{overdue}件</span>}
            </div>
            <ProgressBar done={done} total={kTasks.length} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {kContractors.slice(0, 4).map(c => (
                  <span key={c.id} style={{ fontSize: "10px", background: C.accent + "18", color: C.accent, borderRadius: "4px", padding: "2px 6px", fontWeight: 600 }}>{c.name}</span>
                ))}
                {kContractors.length > 4 && <span style={{ fontSize: "10px", color: C.muted }}>+{kContractors.length - 4}</span>}
              </div>
              <span style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: C.muted }}>{done}/{kTasks.length} タスク</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Contractors Tab ───────────────────────────────────────────
function ContractorsTab({ contractors, kojis, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <Btn variant="ghost" onClick={onAdd} style={{ width: "100%", marginBottom: "14px", padding: "12px", borderStyle: "dashed" }}>＋ 業者を登録</Btn>
      {contractors.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: "48px", fontSize: "14px" }}>業者が登録されていません</div>}
      {contractors.map(c => {
        const assignedKojis = kojis.filter(k => k.contractorIds?.includes(c.id));
        return (
          <div key={c.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "16px 18px", marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: C.text }}>{c.name}</div>
                  <span style={{ fontSize: "11px", background: "#0ea5e922", color: "#0ea5e9", borderRadius: "4px", padding: "2px 7px", fontWeight: 700 }}>{c.shokushu}</span>
                </div>
                {c.manager && <div style={{ fontSize: "12px", color: C.muted, marginBottom: "3px" }}>👤 {c.manager}</div>}
                {c.contact && <div style={{ fontSize: "12px", color: C.muted, marginBottom: "6px" }}>📞 {c.contact}</div>}
                {assignedKojis.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {assignedKojis.map(k => <span key={k.id} style={{ fontSize: "11px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "4px", padding: "2px 7px", color: C.muted }}>🔨 {k.name}</span>)}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <Btn variant="ghost" onClick={() => onEdit(c)} style={{ padding: "5px 10px", fontSize: "12px" }}>編集</Btn>
                <Btn variant="danger" onClick={() => onDelete(c.id)} style={{ padding: "5px 10px", fontSize: "12px" }}>削除</Btn>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────
function DashboardTab({ kojis, tasks, schedules, onGoKoji }) {
  const todayStr = today();
  const active = kojis.filter(k => k.status === "施工中");
  const overdueTasks = tasks.filter(t => t.status !== "完了" && t.due && t.due < todayStr);
  const todayScheds = schedules.filter(s => s.date === todayStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const nearDeadline = kojis.filter(k => { const d = daysLeft(k.end); return d !== null && d >= 0 && d <= 14 && k.status !== "完了"; });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px", marginBottom: "16px" }}>
        {[
          { label: "施工中", value: active.length, color: "#22c55e" },
          { label: "期限切れタスク", value: overdueTasks.length, color: "#ef4444" },
          { label: "今日の予定", value: todayScheds.length, color: C.accent },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${s.color}33`, borderRadius: "12px", padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: "26px", fontWeight: 900, color: s.color, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}>{s.value}</div>
            <div style={{ fontSize: "10px", color: C.muted, fontWeight: 700, marginTop: "2px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: C.muted, marginBottom: "10px", letterSpacing: "0.05em" }}>本日の工程</div>
        {todayScheds.length === 0
          ? <div style={{ fontSize: "13px", color: C.muted }}>本日の工程はありません</div>
          : todayScheds.map(s => {
            const koji = kojis.find(k => k.id === s.kojiId);
            return (
              <div key={s.id} onClick={() => koji && onGoKoji(koji.id)} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px", cursor: "pointer" }}>
                <div style={{ fontSize: "12px", color: C.accent, fontFamily: "'JetBrains Mono', monospace", minWidth: "42px" }}>{s.startTime}</div>
                <div>
                  <div style={{ fontSize: "13px", color: C.text, fontWeight: 600 }}>{s.title}</div>
                  {koji && <div style={{ fontSize: "11px", color: C.muted }}>{koji.name}</div>}
                </div>
              </div>
            );
          })
        }
      </div>

      {nearDeadline.length > 0 && (
        <div style={{ background: "#1c1200", border: "1px solid #78350f", borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: C.accent, marginBottom: "10px" }}>⏰ 竣工まで14日以内</div>
          {nearDeadline.map(k => {
            const d = daysLeft(k.end);
            return <div key={k.id} onClick={() => onGoKoji(k.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", cursor: "pointer" }}>
              <div style={{ fontSize: "13px", color: "#fbbf24", fontWeight: 600 }}>{k.name}</div>
              <div style={{ fontSize: "12px", color: C.accent, fontFamily: "'JetBrains Mono', monospace" }}>残{d}日</div>
            </div>;
          })}
        </div>
      )}

      {overdueTasks.length > 0 && (
        <div style={{ background: "#160808", border: "1px solid #7f1d1d", borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444", marginBottom: "10px" }}>⚠ 期限切れタスク</div>
          {overdueTasks.slice(0, 5).map(t => {
            const k = kojis.find(x => x.id === t.kojiId);
            return <div key={t.id} onClick={() => k && onGoKoji(k.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#fca5a5" }}>{t.title}</div>
                {k && <div style={{ fontSize: "11px", color: C.muted }}>{k.name}</div>}
              </div>
              <div style={{ fontSize: "11px", color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>{fmtDate(t.due)}</div>
            </div>;
          })}
        </div>
      )}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: C.muted, marginBottom: "10px" }}>施工中の工事</div>
        {active.length === 0
          ? <div style={{ fontSize: "13px", color: C.muted }}>施工中の工事がありません</div>
          : active.map(k => {
            const kt = tasks.filter(t => t.kojiId === k.id);
            const done = kt.filter(t => t.status === "完了").length;
            return <div key={k.id} onClick={() => onGoKoji(k.id)} style={{ marginBottom: "10px", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <div style={{ fontSize: "13px", color: C.text, fontWeight: 600 }}>{k.name}</div>
                <span style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: C.muted }}>{done}/{kt.length}</span>
              </div>
              <ProgressBar done={done} total={kt.length} />
            </div>;
          })
        }
      </div>
    </div>
  );
}

// ─── Gist Settings & Sync Button ──────────────────────────────
function GistSettings({ onClose }) {
  const [settings, setSettings] = useState(loadGistSettings);
  const [msg, setMsg] = useState("");
  const save = () => {
    saveGistSettings(settings);
    setMsg("保存しました");
    setTimeout(() => setMsg(""), 2000);
  };
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Gist同期設定" onClose={onClose} />
      <Field label="GitHub Token (classic, gist権限)">
        <Input type="password" value={settings.token || ""} onChange={e => setSettings(s => ({ ...s, token: e.target.value }))} placeholder="ghp_xxxxxxxxxxxx" />
      </Field>
      <Field label="Gist ID">
        <Input value={settings.gistId || ""} onChange={e => setSettings(s => ({ ...s, gistId: e.target.value }))} placeholder="abc123def456..." />
      </Field>
      <div style={{ fontSize: "11px", color: C.muted, marginBottom: "12px", lineHeight: 1.6 }}>
        ※ 事前にgist.github.comでGistを作成してください<br />
        ※ ファイル名は何でもOK（自動で koji-schedules.json に書き込みます）
      </div>
      {msg && <div style={{ color: "#22c55e", fontSize: "12px", marginBottom: "8px" }}>{msg}</div>}
      <Btn variant="primary" onClick={save} style={{ width: "100%", padding: "12px", fontSize: "14px" }}>設定を保存</Btn>
    </Modal>
  );
}

function SyncButton({ kojis, schedules }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const handleSync = async () => {
    setSyncing(true); setResult(null);
    try {
      await syncToGist(kojis, schedules);
      setResult("ok");
    } catch (e) {
      console.error(e);
      setResult("err");
    }
    setSyncing(false);
    setTimeout(() => setResult(null), 3000);
  };
  const { token, gistId } = loadGistSettings();
  if (!token || !gistId) return null;
  return (
    <button onClick={handleSync} disabled={syncing} style={{
      background: result === "ok" ? "#16a34a22" : result === "err" ? "#ef444422" : "#1a2332",
      border: `1px solid ${result === "ok" ? "#16a34a" : result === "err" ? "#ef4444" : "#2d3748"}`,
      borderRadius: "6px", padding: "4px 10px", cursor: syncing ? "wait" : "pointer",
      color: result === "ok" ? "#4ade80" : result === "err" ? "#ef4444" : C.muted,
      fontSize: "11px", fontWeight: 700, fontFamily: "'Noto Sans JP', sans-serif",
      transition: "all 0.2s", whiteSpace: "nowrap",
    }}>
      {syncing ? "同期中..." : result === "ok" ? "✓ 同期完了" : result === "err" ? "✗ 失敗" : "☁ 同期"}
    </button>
  );
}

// ─── App ───────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [kojis, setKojis] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedKojiId, setSelectedKojiId] = useState(null);
  const [modal, setModal] = useState(null);
  const [showGistSettings, setShowGistSettings] = useState(false);

  useEffect(() => {
    const k = loadData("kojis");
    const c = loadData("contractors");
    const t = loadData("tasks");
    const s = loadData("schedules");
    if (k) setKojis(k);
    if (c) setContractors(c);
    if (t) setTasks(t);
    if (s) setSchedules(s);
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) saveData("kojis", kojis); }, [kojis, loaded]);
  useEffect(() => { if (loaded) saveData("contractors", contractors); }, [contractors, loaded]);
  useEffect(() => { if (loaded) saveData("tasks", tasks); }, [tasks, loaded]);
  useEffect(() => { if (loaded) saveData("schedules", schedules); }, [schedules, loaded]);

  const saveKoji = f => { if (f.id) setKojis(ks => ks.map(k => k.id === f.id ? f : k)); else setKojis(ks => [...ks, { ...f, id: Date.now() }]); setModal(null); };
  const saveContractor = f => { if (f.id) setContractors(cs => cs.map(c => c.id === f.id ? f : c)); else setContractors(cs => [...cs, { ...f, id: Date.now() }]); setModal(null); };
  const deleteContractor = id => setContractors(cs => cs.filter(c => c.id !== id));
  const saveTask = f => {
    const w = { ...f, kojiId: selectedKojiId };
    if (f.id) setTasks(ts => ts.map(t => t.id === f.id ? w : t)); else setTasks(ts => [...ts, { ...w, id: Date.now() }]);
    setModal(null);
  };
  const deleteTask = id => setTasks(ts => ts.filter(t => t.id !== id));
  const changeTaskStatus = (id, status) => setTasks(ts => ts.map(t => t.id === id ? { ...t, status } : t));
  const saveSched = f => {
    const w = { ...f, kojiId: selectedKojiId };
    if (f.id) setSchedules(ss => ss.map(s => s.id === f.id ? w : s)); else setSchedules(ss => [...ss, { ...w, id: Date.now() }]);
    setModal(null);
  };
  const deleteSched = id => setSchedules(ss => ss.filter(s => s.id !== id));

  const selectedKoji = kojis.find(k => k.id === selectedKojiId);
  const TABS = [
    { id: "dashboard", label: "概要", icon: "▦" },
    { id: "koji", label: "工事", icon: "🏗" },
    { id: "contractors", label: "業者", icon: "👷" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans JP', sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: C.bg + "ee", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, padding: "env(safe-area-inset-top, 12px) 20px 12px", display: "flex", alignItems: "center", gap: "12px" }}>
        {selectedKoji ? <>
          <button onClick={() => setSelectedKojiId(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "18px" }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "11px", color: C.muted, fontWeight: 700 }}>工事詳細</div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedKoji.name}</div>
          </div>
        </> : <>
          <div style={{ fontSize: "11px", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.15em", color: C.accent, background: C.accent + "18", padding: "4px 10px", borderRadius: "4px" }}>SITE</div>
          <div style={{ fontSize: "18px", fontWeight: 900, color: C.text, letterSpacing: "-0.02em" }}>施工管理</div>
        </>}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <SyncButton kojis={kojis} schedules={schedules} />
          <button onClick={() => setShowGistSettings(true)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "16px", padding: "4px" }}>⚙</button>
          <div style={{ fontSize: "11px", color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
            {new Date().toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit", weekday: "short" })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "20px 16px 100px" }}>
        {selectedKoji ? (
          <KojiDetail
            koji={selectedKoji} contractors={contractors} tasks={tasks} schedules={schedules}
            onBack={() => setSelectedKojiId(null)} onEditKoji={() => setModal({ type: "koji", data: selectedKoji })}
            onAddTask={() => setModal({ type: "task" })} onEditTask={t => setModal({ type: "task", data: t })}
            onDeleteTask={deleteTask} onStatusTask={changeTaskStatus}
            onAddSched={() => setModal({ type: "sched" })} onEditSched={s => setModal({ type: "sched", data: s })}
            onDeleteSched={deleteSched}
          />
        ) : (
          <>
            {tab === "dashboard" && <DashboardTab kojis={kojis} tasks={tasks} schedules={schedules} onGoKoji={id => { setSelectedKojiId(id); setTab("koji"); }} />}
            {tab === "koji" && <KojiList kojis={kojis} contractors={contractors} tasks={tasks} onSelect={id => setSelectedKojiId(id)} onAdd={() => setModal({ type: "koji" })} />}
            {tab === "contractors" && <ContractorsTab contractors={contractors} kojis={kojis} onAdd={() => setModal({ type: "contractor" })} onEdit={c => setModal({ type: "contractor", data: c })} onDelete={deleteContractor} />}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      {!selectedKoji && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.bg + "f0", backdropFilter: "blur(12px)", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "8px 0 max(8px,env(safe-area-inset-bottom))" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "4px 20px" }}>
              <div style={{ fontSize: "20px", opacity: tab === t.id ? 1 : 0.35 }}>{t.icon}</div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: tab === t.id ? C.accent : C.muted, fontFamily: "'Noto Sans JP', sans-serif" }}>{t.label}</div>
              {tab === t.id && <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: C.accent }} />}
            </button>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.type === "koji" && <KojiForm initial={modal.data} contractors={contractors} onSave={saveKoji} onClose={() => setModal(null)} />}
      {modal?.type === "contractor" && <ContractorForm initial={modal.data} onSave={saveContractor} onClose={() => setModal(null)} />}
      {modal?.type === "task" && <TaskForm initial={modal.data} contractors={selectedKoji ? contractors.filter(c => selectedKoji.contractorIds?.includes(c.id)) : contractors} onSave={saveTask} onClose={() => setModal(null)} />}
      {modal?.type === "sched" && <SchedForm initial={modal.data} onSave={saveSched} onClose={() => setModal(null)} />}
      {showGistSettings && <GistSettings onClose={() => setShowGistSettings(false)} />}
    </div>
  );
}
