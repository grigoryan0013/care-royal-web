"use client";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../app/lib/session";
import SignaturePad from "./SignaturePad";

interface Doc {
  docId: string; template: string; templateLabel: string; title: string; content: string;
  status: string; signedBy: string; signedAt: string; signature?: string; householdName: string; recipientName: string; createdAt: string;
}

// Open a print-to-PDF window with the formatted document + signature.
export function printDoc(d: Doc) {
  const sig = d.signature && d.signature.startsWith("data:image")
    ? `<img src="${d.signature}" style="height:64px" />`
    : `<div style="font-family:'Fraunces',Georgia,serif;font-size:28px">${d.signedBy || ""}</div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${d.title}</title>
    <style>body{font-family:Inter,system-ui,sans-serif;color:#14181B;max-width:720px;margin:48px auto;padding:0 24px;line-height:1.6}
    h1{font-family:'Fraunces',Georgia,serif;color:#4B39EF} .meta{color:#8b95a1;font-size:12px;margin-bottom:24px}
    pre{white-space:pre-wrap;font-family:inherit;font-size:14px} .sig{margin-top:48px;border-top:1px solid #E0E3E7;padding-top:16px}
    .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8b95a1}</style></head>
    <body><h1>${d.title}</h1><div class="meta">The Care Royal${d.householdName ? " — " + d.householdName : ""}</div>
    <pre>${(d.content || "").replace(/</g, "&lt;")}</pre>
    <div class="sig"><div class="lbl">Signature</div>${d.status === "signed" ? sig : "<div style='color:#8b95a1'>Unsigned</div>"}
    ${d.status === "signed" ? `<div class="meta">Signed by ${d.signedBy} on ${d.signedAt ? new Date(d.signedAt).toLocaleString() : ""}</div>` : ""}</div>
    <script>window.onload=function(){window.print()}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

// Signing panel for family and caregiver portals.
export default function DocumentsPanel() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const load = useCallback(async () => {
    const d = await apiGet("/api/documents").catch(() => ({ documents: [] }));
    setDocs(d.documents || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (docs.length === 0) return <div className="card"><p className="text-sm text-ink-light">No documents yet.</p></div>;
  return (
    <div className="space-y-4">
      {docs.map((d) => <DocCard key={d.docId} d={d} onChange={load} />)}
    </div>
  );
}

export function DocCard({ d, onChange }: { d: Doc; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const signed = d.status === "signed";

  async function sign(signature: string, signerName: string) {
    setBusy(true);
    try { await apiPost("/api/documents", { action: "sign", docId: d.docId, signature, signerName }); setOpen(false); onChange(); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-serif text-lg text-ink">{d.title || d.templateLabel}</h3>
        <div className="flex items-center gap-2">
          <span className={signed ? "badge-ok" : "badge-warn"}>{signed ? "Signed" : "Awaiting signature"}</span>
          <button onClick={() => printDoc(d)} className="btn-ghost btn-sm">Download</button>
        </div>
      </div>
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-paper p-4 font-sans text-xs leading-relaxed text-ink-mid">{d.content}</pre>
      {signed ? (
        <div className="mt-3 flex items-center gap-3">
          {d.signature && d.signature.startsWith("data:image")
            ? <img src={d.signature} alt="signature" className="h-12 rounded border border-rule bg-white px-2" />
            : <span className="font-serif text-2xl text-ink">{d.signedBy}</span>}
          <p className="text-xs text-ink-light">Signed by {d.signedBy} on {d.signedAt ? new Date(d.signedAt).toLocaleString() : ""}</p>
        </div>
      ) : open ? (
        <div className="mt-4"><SignaturePad onSign={sign} busy={busy} /></div>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary mt-4">Review & sign</button>
      )}
    </div>
  );
}
