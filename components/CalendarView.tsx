"use client";
import { useRef, useState } from "react";

export interface CalEvent {
  id?: string;
  date: string;   // ISO datetime (start)
  end?: string;   // ISO datetime (optional end)
  label: string;
  sub?: string;
  tone?: "brand" | "gold" | "ok" | "danger";
}

type View = "month" | "week" | "day";

const toneClass: Record<string, string> = {
  brand: "bg-brand-light text-brand hover:bg-brand/20 border-brand/30",
  gold: "bg-gold/20 text-gold-dark hover:bg-gold/30 border-gold/40",
  ok: "bg-ok/15 text-ok hover:bg-ok/25 border-ok/30",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 border-danger/30",
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00 – 21:00
const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfWeek = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x; };
const hourLabel = (h: number) => { const ap = h < 12 ? "am" : "pm"; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr}${ap}`; };
const fmtEvTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/**
 * Fully interactive calendar: month / week / day views, click an empty slot to
 * create, click an event to open it, and drag an event to reschedule it.
 */
export default function CalendarView({
  events, onSelect, onCreate, onMove,
}: {
  events: CalEvent[];
  onSelect?: (id: string) => void;
  onCreate?: (iso: string) => void;                 // clicked empty slot
  onMove?: (id: string, iso: string) => void;       // dragged event to new time
}) {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const drag = useRef<string | null>(null);

  const evById = (id: string) => events.find((e) => e.id === id);
  // Month drop keeps the event's time-of-day (MonthGrid computes the target date).
  const dropAt = (target: Date) => {
    const id = drag.current; drag.current = null;
    if (!id || !onMove) return;
    onMove(id, target.toISOString());
  };

  function shift(dir: number) {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  }

  const title = view === "month"
    ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : view === "day"
      ? cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
      : (() => { const s = startOfWeek(cursor); const e = new Date(s); e.setDate(e.getDate() + 6); return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`; })();

  return (
    <div className="card !p-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="btn-ghost btn-sm" aria-label="Previous">‹</button>
          <button onClick={() => setCursor(new Date())} className="btn-ghost btn-sm">Today</button>
          <button onClick={() => shift(1)} className="btn-ghost btn-sm" aria-label="Next">›</button>
          <h3 className="ml-1 font-serif text-lg font-bold text-ink">{title}</h3>
        </div>
        <div className="inline-flex rounded-xl border border-rule bg-paper p-1">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === v ? "bg-white text-brand shadow-sm" : "text-ink-mid hover:text-ink"}`}>{v}</button>
          ))}
        </div>
      </div>

      {view === "month" && <MonthGrid cursor={cursor} events={events} onSelect={onSelect} onCreate={onCreate} drag={drag} dropAt={(d) => dropAt(d)} evById={evById} />}
      {view !== "month" && <TimeGrid days={view === "day" ? [new Date(cursor)] : weekDays(cursor)} events={events} onSelect={onSelect} onCreate={onCreate} drag={drag} evById={evById} onMove={onMove} />}
      {onCreate && <p className="border-t border-rule px-4 py-2 text-center text-xs text-ink-light">Tip: click any empty slot to schedule · drag an appointment to reschedule it</p>}
    </div>
  );
}

function weekDays(cursor: Date) {
  const s = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d; });
}

// ---- Month ----------------------------------------------------------------
function MonthGrid({ cursor, events, onSelect, onCreate, drag, dropAt, evById }: {
  cursor: Date; events: CalEvent[]; onSelect?: (id: string) => void; onCreate?: (iso: string) => void;
  drag: React.MutableRefObject<string | null>; dropAt: (d: Date) => void; evById: (id: string) => CalEvent | undefined;
}) {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = keyOf(new Date());

  const byDay: Record<number, CalEvent[]> = {};
  for (const e of events) { if (!e.date) continue; const d = new Date(e.date); if (d.getFullYear() === year && d.getMonth() === month) (byDay[d.getDate()] ||= []).push(e); }
  for (const k in byDay) byDay[k].sort((a, b) => a.date.localeCompare(b.date));

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const onDropDay = (d: number) => {
    const id = drag.current; const ev = id ? evById(id) : undefined;
    if (!ev) { drag.current = null; return; }
    const src = new Date(ev.date);
    dropAt(new Date(year, month, d, src.getHours(), src.getMinutes()));
  };

  return (
    <div className="grid grid-cols-7 gap-px bg-rule text-xs">
      {DAYS.map((d) => <div key={d} className="bg-paper py-2 text-center font-semibold text-ink-light">{d}</div>)}
      {cells.map((d, i) => {
        const isToday = d != null && keyOf(new Date(year, month, d)) === todayKey;
        return (
          <div
            key={i}
            onClick={() => d != null && onCreate?.(new Date(year, month, d, 9, 0).toISOString())}
            onDragOver={(e) => { if (d != null) e.preventDefault(); }}
            onDrop={() => d != null && onDropDay(d)}
            className={`min-h-[104px] bg-white p-1.5 ${d == null ? "bg-paper/50" : onCreate ? "cursor-pointer hover:bg-brand-light/40" : ""}`}
          >
            {d != null && (
              <>
                <div className={`mb-1 text-right text-[11px] ${isToday ? "font-bold text-brand" : "text-ink-light"}`}>{isToday ? <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-brand text-white">{d}</span> : d}</div>
                <div className="space-y-1">
                  {(byDay[d] || []).slice(0, 4).map((e, j) => (
                    <button
                      key={j}
                      draggable={!!e.id && !!onSelect}
                      onDragStart={() => { drag.current = e.id || null; }}
                      onClick={(ev) => { ev.stopPropagation(); e.id && onSelect?.(e.id); }}
                      disabled={!e.id || !onSelect}
                      className={`block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium transition ${toneClass[e.tone || "brand"]} ${e.id && onSelect ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                      title={`${e.label}${e.sub ? " — " + e.sub : ""}`}
                    >
                      {fmtEvTime(e.date)} {e.label}
                    </button>
                  ))}
                  {(byDay[d] || []).length > 4 && <div className="px-1 text-[10px] text-ink-light">+{(byDay[d] || []).length - 4} more</div>}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Week / Day (time grid) ----------------------------------------------
function TimeGrid({ days, events, onSelect, onCreate, drag, evById, onMove }: {
  days: Date[]; events: CalEvent[]; onSelect?: (id: string) => void; onCreate?: (iso: string) => void;
  drag: React.MutableRefObject<string | null>; evById: (id: string) => CalEvent | undefined; onMove?: (id: string, iso: string) => void;
}) {
  const todayKey = keyOf(new Date());
  // bucket events by dayKey + hour
  const bucket: Record<string, CalEvent[]> = {};
  for (const e of events) { if (!e.date) continue; const d = new Date(e.date); (bucket[`${keyOf(d)}|${d.getHours()}`] ||= []).push(e); }

  const drop = (day: Date, hour: number) => {
    const id = drag.current; drag.current = null;
    if (!id || !onMove) return;
    const ev = evById(id); if (!ev) return;
    const src = new Date(ev.date);
    onMove(id, new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, src.getMinutes()).toISOString());
  };

  return (
    <div className="max-h-[560px] overflow-auto">
      <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
        {/* header row */}
        <div className="sticky top-0 z-10 border-b border-rule bg-white" />
        {days.map((d) => {
          const isToday = keyOf(d) === todayKey;
          return (
            <div key={keyOf(d)} className={`sticky top-0 z-10 border-b border-l border-rule bg-white py-2 text-center ${isToday ? "text-brand" : "text-ink-mid"}`}>
              <div className="text-[11px] font-semibold uppercase">{DAYS[d.getDay()]}</div>
              <div className={`mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${isToday ? "bg-brand text-white" : "text-ink"}`}>{d.getDate()}</div>
            </div>
          );
        })}
        {/* hour rows */}
        {HOURS.map((h) => (
          <div key={h} className="contents">
            <div className="border-b border-rule py-3 pr-2 text-right text-[10px] font-medium text-ink-light">{hourLabel(h)}</div>
            {days.map((d) => {
              const cell = bucket[`${keyOf(d)}|${h}`] || [];
              return (
                <div
                  key={keyOf(d) + h}
                  onClick={() => onCreate?.(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0).toISOString())}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => drop(d, h)}
                  className={`min-h-[52px] border-b border-l border-rule p-1 ${onCreate ? "cursor-pointer hover:bg-brand-light/30" : ""}`}
                >
                  <div className="space-y-1">
                    {cell.map((e, j) => (
                      <button
                        key={j}
                        draggable={!!e.id && !!onSelect}
                        onDragStart={() => { drag.current = e.id || null; }}
                        onClick={(ev) => { ev.stopPropagation(); e.id && onSelect?.(e.id); }}
                        disabled={!e.id || !onSelect}
                        className={`block w-full rounded-md border px-1.5 py-1 text-left text-[11px] font-medium leading-tight transition ${toneClass[e.tone || "brand"]} ${e.id && onSelect ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                        title={`${e.label}${e.sub ? " — " + e.sub : ""}`}
                      >
                        <div className="truncate font-semibold">{e.label}</div>
                        {e.sub && <div className="truncate opacity-80">{e.sub}</div>}
                        <div className="opacity-70">{fmtEvTime(e.date)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
