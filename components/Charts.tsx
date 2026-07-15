"use client";
// Dependency-free SVG charts tuned to the Care Royal palette.
const TONE: Record<string, string> = {
  brand: "#4B39EF", purple: "#673AB7", gold: "#39D2C0", ok: "#1f9d55",
  danger: "#d64545", muted: "#cdd3da",
};

export function BarChart({ data, height = 160, prefix = "" }: { data: { label: string; value: number; tone?: string }[]; height?: number; prefix?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
          <div className="text-[10px] font-semibold text-ink-mid">{d.value ? prefix + (d.value % 1 ? d.value.toFixed(1) : d.value) : ""}</div>
          <div className="w-full rounded-t transition-all" style={{ height: `${(d.value / max) * (height - 34)}px`, minHeight: d.value ? 3 : 0, background: TONE[d.tone || "brand"] }} title={`${d.label}: ${d.value}`} />
          <div className="w-full truncate text-center text-[10px] text-ink-light">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, size = 150 }: { segments: { label: string; value: number; tone?: string }[]; size?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E0E3E7" strokeWidth={16} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE[s.tone || "brand"]} strokeWidth={16} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE[s.tone || "brand"] }} />
            <span className="text-ink-mid">{s.label}</span>
            <span className="ml-auto font-semibold text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
