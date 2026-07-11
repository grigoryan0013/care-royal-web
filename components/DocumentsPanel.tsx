"use client";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../app/lib/session";

interface Doc {
  docId: string; template: string; templateLabel: string; title: string; content: string;
  status: string; signedBy: string; signedAt: string; householdName: string; recipientName: string; createdAt: string;
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

function DocCard({ d, onChange }: { d: Doc; onChange: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const signed = d.status === "signed";

  async function sign() {
    if (!name.trim()) return;
    setBusy(true);
    try { await apiPost("/api/documents", { action: "sign", docId: d.docId, signature: name.trim(), signerName: name.trim() }); onChange(); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-serif text-lg text-ink">{d.title || d.templateLabel}</h3>
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${signed ? "bg-ok/15 text-ok" : "bg-gold/20 text-gold-dark"}`}>
          {signed ? "Signed" : "Awaiting signature"}
        </span>
      </div>
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-paper p-4 font-sans text-xs leading-relaxed text-ink-mid">{d.content}</pre>
      {signed ? (
        <p className="mt-3 text-xs text-ink-light">Signed by {d.signedBy} on {d.signedAt ? new Date(d.signedAt).toLocaleString() : ""}</p>
      ) : (
        <div className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Type your full name to sign</label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full legal name" />
          </div>
          <button onClick={sign} disabled={busy || !name.trim()} className="btn-primary">{busy ? "…" : "Sign"}</button>
        </div>
      )}
    </div>
  );
}
