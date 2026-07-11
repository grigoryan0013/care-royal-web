"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../app/lib/session";

interface Thread { householdId: string; name: string; lastText: string; lastAt: string }
interface Message { messageId: string; fromUid: string; fromName: string; fromRole: string; text: string; createdAt: string }

const roleLabel: Record<string, string> = {
  agency_admin: "Care team", agency_coord: "Care team", caregiver: "Caregiver", family: "Family",
};

export default function MessagesPanel() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [meUid, setMeUid] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const [t, s] = await Promise.all([apiGet("/api/threads").catch(() => ({ threads: [] })), apiGet("/api/auth").catch(() => ({ user: {} }))]);
    setThreads(t.threads || []);
    setMeUid(s.user?.userId || "");
    if (!active && (t.threads || []).length) setActive(t.threads[0].householdId);
  }, [active]);

  const loadMessages = useCallback(async (hid: string) => {
    if (!hid) return;
    const d = await apiGet(`/api/messages?householdId=${hid}`).catch(() => ({ messages: [] }));
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

  if (threads.length === 0) return <div className="card"><p className="text-sm text-ink-light">No conversations yet.</p></div>;

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="card !p-2">
        {threads.map((t) => (
          <button key={t.householdId} onClick={() => setActive(t.householdId)}
            className={`block w-full rounded-lg px-3 py-2.5 text-left ${active === t.householdId ? "bg-brand-light" : "hover:bg-paper"}`}>
            <div className="text-sm font-medium text-ink">{t.name}</div>
            <div className="truncate text-xs text-ink-light">{t.lastText || "No messages yet"}</div>
          </button>
        ))}
      </div>

      <div className="card flex h-[520px] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && <p className="text-sm text-ink-light">Start the conversation below.</p>}
          {messages.map((m) => {
            const mine = m.fromUid === meUid;
            return (
              <div key={m.messageId} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
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
          <button onClick={send} disabled={!text.trim()} className="btn-primary">Send</button>
        </div>
      </div>
    </div>
  );
}
