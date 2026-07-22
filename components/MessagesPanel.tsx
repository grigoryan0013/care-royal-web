"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../app/lib/session";

interface Thread { householdId: string; type?: string; name: string; lastText: string; lastAt: string }
interface Message { messageId: string; fromUid: string; fromName: string; fromRole: string; text: string; createdAt: string }

const roleLabel: Record<string, string> = {
  agency_admin: "Care team", agency_coord: "Care team", manager: "Manager", caregiver: "Caregiver", family: "Family",
};
const initials = (s: string) => (s || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default function MessagesPanel() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [meUid, setMeUid] = useState("");
  const [q, setQ] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const [t, s] = await Promise.all([apiGet("/api/threads").catch(() => ({ threads: [] })), apiGet("/api/auth").catch(() => ({ user: {} }))]);
    setThreads(t.threads || []);
    setMeUid(s.user?.userId || "");
    setActive((cur) => cur || (t.threads?.[0]?.householdId ?? ""));
  }, []);

  const loadMessages = useCallback(async (hid: string) => {
    if (!hid) return;
    const d = await apiGet(`/api/messages?householdId=${encodeURIComponent(hid)}`).catch(() => ({ messages: [] }));
    setMessages(d.messages || []);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);
  useEffect(() => { if (active) loadMessages(active); }, [active, loadMessages]);

  async function send() {
    if (!text.trim() || !active) return;
    await apiPost("/api/messages", { householdId: active, text: text.trim() });
    setText("");
    loadMessages(active);
    loadThreads();
  }

  if (threads.length === 0) return <div className="card"><p className="text-sm text-ink-light">No conversations yet. When a client or caregiver messages you, it appears here.</p></div>;

  const match = (t: Thread) => !q || t.name.toLowerCase().includes(q.toLowerCase());
  const clients = threads.filter((t) => (t.type || "client") === "client" && match(t));
  const support = threads.filter((t) => t.type === "support" && match(t));
  const activeThread = threads.find((t) => t.householdId === active);

  const ThreadBtn = ({ t }: { t: Thread }) => (
    <button onClick={() => setActive(t.householdId)}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${active === t.householdId ? "bg-brand-light" : "hover:bg-paper"}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${t.type === "support" ? "bg-gold-dark" : "bg-brand"}`}>{t.type === "support" ? "S" : initials(t.name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{t.name}</span>
        <span className="block truncate text-xs text-ink-light">{t.lastText || "No messages yet"}</span>
      </span>
    </button>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <div className="card flex max-h-[560px] flex-col !p-2">
        <input className="field field-sm mb-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" />
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {clients.length > 0 && <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-light">Clients</div>}
          {clients.map((t) => <ThreadBtn key={t.householdId} t={t} />)}
          {support.length > 0 && <div className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-light">Support &amp; team</div>}
          {support.map((t) => <ThreadBtn key={t.householdId} t={t} />)}
        </div>
      </div>

      <div className="card flex h-[560px] flex-col">
        {activeThread && (
          <div className="mb-3 flex items-center gap-2 border-b border-rule pb-3">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${activeThread.type === "support" ? "bg-gold-dark" : "bg-brand"}`}>{activeThread.type === "support" ? "S" : initials(activeThread.name)}</span>
            <div>
              <div className="text-sm font-semibold text-ink">{activeThread.name}</div>
              <div className="text-[11px] text-ink-light">{activeThread.type === "support" ? "Support channel" : "Client conversation"}</div>
            </div>
          </div>
        )}
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && <p className="text-sm text-ink-light">Start the conversation below.</p>}
          {messages.map((m) => {
            const mine = m.fromUid === meUid;
            return (
              <div key={m.messageId} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper text-[10px] font-bold text-ink-mid">{initials(m.fromName)}</span>}
                <div className={`max-w-[75%] rounded-xl2 px-3.5 py-2 ${mine ? "bg-brand text-white" : "bg-paper text-ink"}`}>
                  {!mine && <div className="mb-0.5 text-[11px] font-semibold text-ink-light">{m.fromName} · {roleLabel[m.fromRole] || m.fromRole}</div>}
                  <div className="whitespace-pre-wrap text-sm">{m.text}</div>
                  <div className={`mt-0.5 text-[10px] ${mine ? "text-white/70" : "text-ink-light"}`}>{m.createdAt ? new Date(m.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div className="mt-3 flex gap-2 border-t border-rule pt-3">
          <input className="field" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Write a message…" />
          <button onClick={send} disabled={!text.trim()} className="btn-gradient">Send</button>
        </div>
      </div>
    </div>
  );
}
