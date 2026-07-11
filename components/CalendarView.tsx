"use client";
import { useState } from "react";

export interface CalEvent {
  date: string;   // ISO datetime
  label: string;
  sub?: string;
  tone?: "brand" | "gold" | "ok" | "danger";
}

const toneClass: Record<string, string> = {
  brand: "bg-brand-light text-brand",
  gold: "bg-gold/20 text-gold-dark",
  ok: "bg-ok/15 text-ok",
  danger: "bg-danger/15 text-danger",
};

// Simple in-app month calendar. Events are plotted on their day.
export default function CalendarView({ events }: { events: CalEvent[] }) {
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
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="btn-ghost !px-3 !py-1.5 text-sm">Prev</button>
          <button onClick={() => setCursor(new Date())} className="btn-ghost !px-3 !py-1.5 text-sm">Today</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="btn-ghost !px-3 !py-1.5 text-sm">Next</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-rule text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-paper py-2 text-center font-semibold text-ink-light">{d}</div>
        ))}
        {cells.map((d, i) => {
          const isToday = d != null && new Date(year, month, d).toDateString() === todayKey;
          return (
            <div key={i} className={`min-h-[92px] bg-white p-1.5 ${d == null ? "opacity-40" : ""}`}>
              {d != null && (
                <>
                  <div className={`mb-1 text-right text-[11px] ${isToday ? "font-bold text-brand" : "text-ink-light"}`}>{d}</div>
                  <div className="space-y-1">
                    {(byDay[d] || []).slice(0, 3).map((e, j) => (
                      <div key={j} className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${toneClass[e.tone || "brand"]}`} title={`${e.label}${e.sub ? " — " + e.sub : ""}`}>
                        {new Date(e.date).toLocaleTimeString([], { hour: "numeric" })} {e.label}
                      </div>
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
