"use client";
import { useState } from "react";

export interface CalEvent {
  id?: string;
  date: string;   // ISO datetime
  label: string;
  sub?: string;
  tone?: "brand" | "gold" | "ok" | "danger";
}

const toneClass: Record<string, string> = {
  brand: "bg-brand-light text-brand hover:bg-brand/15",
  gold: "bg-gold/20 text-gold-dark hover:bg-gold/30",
  ok: "bg-ok/15 text-ok hover:bg-ok/25",
  danger: "bg-danger/15 text-danger hover:bg-danger/25",
};

// In-app month calendar. Events plot on their day; clicking one calls onSelect.
export default function CalendarView({ events, onSelect }: { events: CalEvent[]; onSelect?: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toDateString();

  const byDay: Record<number, CalEvent[]> = {};
  for (const e of events) {
    if (!e.date) continue;
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) (byDay[d.getDate()] ||= []).push(e);
  }
  for (const k in byDay) byDay[k].sort((a, b) => a.date.localeCompare(b.date));

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-xl text-ink">{monthLabel}</h3>
        <div className="flex gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="btn-ghost btn-sm">Prev</button>
          <button onClick={() => setCursor(new Date())} className="btn-ghost btn-sm">Today</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="btn-ghost btn-sm">Next</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-rule text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-paper py-2 text-center font-semibold text-ink-light">{d}</div>
        ))}
        {cells.map((d, i) => {
          const isToday = d != null && new Date(year, month, d).toDateString() === todayKey;
          return (
            <div key={i} className={`min-h-[96px] bg-white p-1.5 ${d == null ? "opacity-40" : ""}`}>
              {d != null && (
                <>
                  <div className={`mb-1 text-right text-[11px] ${isToday ? "font-bold text-brand" : "text-ink-light"}`}>{d}</div>
                  <div className="space-y-1">
                    {(byDay[d] || []).slice(0, 3).map((e, j) => (
                      <button
                        key={j}
                        onClick={() => e.id && onSelect?.(e.id)}
                        disabled={!e.id || !onSelect}
                        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition ${toneClass[e.tone || "brand"]} ${e.id && onSelect ? "cursor-pointer" : "cursor-default"}`}
                        title={`${e.label}${e.sub ? " — " + e.sub : ""}`}
                      >
                        {new Date(e.date).toLocaleTimeString([], { hour: "numeric" })} {e.label}
                      </button>
                    ))}
                    {(byDay[d] || []).length > 3 && <div className="px-1 text-[10px] text-ink-light">+{(byDay[d] || []).length - 3} more</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
