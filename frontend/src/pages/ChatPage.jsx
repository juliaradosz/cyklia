import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { formatPL } from "../utils.js";

const PROMPTS = [
  "Kiedy mam okres?",
  "Kiedy mam owulację?",
  "Kiedy są moje dni płodne?",
  "Który to dzień mojego cyklu?",
  "Co pomaga na PMS?",
  "Jak mierzyć temperaturę?",
];

export default function ChatPage() {
  const [sessions, setSessions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [view, setView] = useState("list");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottom = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        let list = await api("/chat/sessions");
        if (!list.length) {
          const created = await api("/chat/sessions", { method: "POST" });
          list = [created];
        }
        setSessions(list);
        const first = list[0];
        const data = await api(`/chat/sessions/${first.id}`);
        setCurrent(first.id);
        setMessages(data.messages || []);
        setView("chat");
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function refreshSessions() {
    try {
      setSessions(await api("/chat/sessions"));
    } catch {
      /* ignore */
    }
  }

  async function openSession(id) {
    setBusy(false);
    try {
      const data = await api(`/chat/sessions/${id}`);
      setCurrent(id);
      setMessages(data.messages || []);
      setView("chat");
    } catch {
      /* ignore */
    }
  }

  async function newConversation() {
    try {
      const created = await api("/chat/sessions", { method: "POST" });
      setSessions((s) => [created, ...s]);
      setCurrent(created.id);
      setMessages([{ role: "assistant", content: created.last_message }]);
      setView("chat");
    } catch {
      /* ignore */
    }
  }

  async function removeSession(id) {
    try {
      await api(`/chat/sessions/${id}`, { method: "DELETE" });
      const next = sessions.filter((s) => s.id !== id);
      setSessions(next);
      if (current === id) {
        setCurrent(null);
        setMessages([]);
        setView("list");
      }
    } catch {
      /* ignore */
    }
  }

  async function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || busy || !current) return;
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api(`/chat/sessions/${current}`, {
        method: "POST",
        body: { message: msg },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      setSessions((list) =>
        list.map((s) => {
          if (s.id !== current) return s;
          return {
            ...s,
            title: s.title === "Nowa rozmowa" ? autoTitle(msg) : s.title,
            last_message: res.reply,
          };
        })
      );
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Coś poszło nie tak. Spróbuj jeszcze raz za chwilę. 💛",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="center-screen">Ładowanie…</div>;

  const currentSession = sessions.find((s) => s.id === current) || null;

  if (view === "list") {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Rozmowy</h1>
            <div className="sub">Twój asystent zdrowia — tematy osobno</div>
          </div>
        </div>

        <button className="btn block mb" onClick={newConversation}>
          ＋ Nowa rozmowa
        </button>

        {sessions.length === 0 && (
          <div className="card center">
            <p className="muted">
              Nie masz jeszcze rozmów. Rozpocznij nową — np. o owulacji albo PMS.
            </p>
          </div>
        )}

        <div className="chat-list">
          {sessions.map((s) => (
            <div key={s.id} className="chat-list-card">
              <button
                className="chat-list-main"
                onClick={() => openSession(s.id)}
              >
                <div className="chat-list-title">
                  {s.title === "Nowa rozmowa" ? "💬 Nowa rozmowa" : `💬 ${s.title}`}
                </div>
                <div className="chat-list-snippet">
                  {s.last_message || "Brak wiadomości"}
                </div>
                <div className="chat-list-meta">
                  {formatPL(s.updated_at.slice(0, 10))} · {s.msg_count}{" "}
                  {s.msg_count === 1 ? "wiadomość" : "wiadomości"}
                </div>
              </button>
              <button
                className="chat-list-del"
                onClick={() => removeSession(s.id)}
                aria-label="Usuń rozmowę"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="chat-view-head">
        <button className="chat-back" onClick={() => { setView("list"); refreshSessions(); }} aria-label="Lista rozmów">
          ←
        </button>
        <div className="chat-title">
          {currentSession?.title || "Rozmowa"}
        </div>
        <button
          className="chat-del"
          onClick={() => removeSession(current)}
          aria-label="Usuń rozmowę"
        >
          🗑
        </button>
      </div>

      <div className="chips mb">
        {PROMPTS.map((p) => (
          <button key={p} className="chip" onClick={() => send(p)}>
            {p}
          </button>
        ))}
      </div>

      <div className="chat-box">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="typing">Asystent pisze…</div>}
        <div ref={bottom} />
      </div>

      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Zadaj pytanie…"
          disabled={busy}
        />
        <button onClick={() => send()} disabled={busy}>
          ➤
        </button>
      </div>
    </div>
  );
}

function autoTitle(msg) {
  return msg.length <= 42 ? msg : msg.slice(0, 42) + "…";
}
