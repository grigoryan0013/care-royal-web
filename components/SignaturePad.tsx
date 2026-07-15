"use client";
import { useRef, useState, useEffect } from "react";

// Signature capture: type OR draw. Returns a data URL (drawn) or the typed name.
export default function SignaturePad({ onSign, busy }: { onSign: (signature: string, signerName: string) => void; busy?: boolean }) {
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [name, setName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || mode !== "draw") return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#14181B";
    hasInk.current = false;
  }, [mode]);

  function pos(e: React.PointerEvent) {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (cv.width / rect.width), y: (e.clientY - rect.top) * (cv.height / rect.height) };
  }
  function down(e: React.PointerEvent) { drawing.current = true; const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e: React.PointerEvent) { if (!drawing.current) return; const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasInk.current = true; }
  function up() { drawing.current = false; }
  function clear() { const cv = canvasRef.current!; cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height); hasInk.current = false; }

  function submit() {
    if (mode === "type") { if (name.trim()) onSign(name.trim(), name.trim()); return; }
    if (!hasInk.current || !name.trim()) return;
    onSign(canvasRef.current!.toDataURL("image/png"), name.trim());
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-rule bg-white p-1">
        <button type="button" onClick={() => setMode("type")} className={mode === "type" ? "chip-on" : "chip-off !bg-transparent !text-ink-mid"}>Type</button>
        <button type="button" onClick={() => setMode("draw")} className={mode === "draw" ? "chip-on" : "chip-off !bg-transparent !text-ink-mid"}>Draw</button>
      </div>

      <div>
        <label className="label">Full legal name</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full legal name" />
      </div>

      {mode === "draw" && (
        <div>
          <label className="label">Draw your signature</label>
          <canvas ref={canvasRef} width={480} height={140} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
            className="w-full touch-none rounded-lg border border-rule-dark bg-white" style={{ cursor: "crosshair" }} />
          <button type="button" onClick={clear} className="mt-1 text-xs font-semibold text-ink-light hover:text-danger">Clear</button>
        </div>
      )}

      <button onClick={submit} disabled={busy || !name.trim()} className="btn-primary">{busy ? "…" : "Sign document"}</button>
    </div>
  );
}
