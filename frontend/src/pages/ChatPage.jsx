import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { formatPL } from "../utils.js";
import { useAuth } from "../api/auth.jsx";
import Icon from "../components/Icon.jsx";

const PROMPTS = [
  "Kiedy mam okres?",
  "Kiedy mam owulację?",
  "Kiedy są moje dni płodne?",
  "Który to dzień mojego cyklu?",
  "Co pomaga na PMS?",
  "Jak mierzyć temperaturę?",
];

const SUGGESTIONS = [
  { icon: "calendar", text: "Kiedy przewidujesz mój kolejny okres?" },
  { icon: "heart", text: "Co oznaczają moje ostatnie objawy?" },
  { icon: "repeat", text: "Podsumuj mój ostatni cykl" },
  { icon: "sun", text: "Jak łagodzić PMS?" },
];

export default function ChatPage() {
  const { user } = useAuth();
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
  const showIntro = messages.length <= 1;

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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="plus" size={18} /> Nowa rozmowa
          </span>
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
                <span className="cl-avatar">
                  <Icon name="sparkles" size={20} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="chat-list-title">
                    {s.title === "Nowa rozmowa" ? "Nowa rozmowa" : s.title}
                  </span>
                  <span className="chat-list-snippet">
                    {s.last_message || "Brak wiadomości"}
                  </span>
                  <span className="chat-list-meta">
                    {formatPL(s.updated_at.slice(0, 10))} · {s.msg_count}{" "}
                    {s.msg_count === 1 ? "wiadomość" : "wiadomości"}
                  </span>
                </span>
                <span className="chat-list-go">
                  <Icon name="chevron-right" size={18} />
                </span>
              </button>
              <button
                className="chat-list-del"
                onClick={() => removeSession(s.id)}
                aria-label="Usuń rozmowę"
              >
                <Icon name="trash" size={18} />
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
        <button
          className="icon-btn"
          onClick={() => {
            setView("list");
            refreshSessions();
          }}
          aria-label="Lista rozmów"
        >
          <Icon name="chevron-left" size={20} />
        </button>
        <div className="chat-title">{currentSession?.title || "Rozmowa"}</div>
        <button
          className="icon-btn"
          style={{ color: "var(--ink-3)" }}
          onClick={() => removeSession(current)}
          aria-label="Usuń rozmowę"
        >
          <Icon name="trash" size={18} />
        </button>
      </div>

      {showIntro && (
        <>
          <div className="welcome-card">
            <span className="wc-ico">
              <Icon name="sparkles" size={22} />
            </span>
            <h3>Hej, {user?.display_name || "piękna"} 👋</h3>
            <p>
              Jestem asystentem Cyklii. Mogę korzystać z danych Twojego cyklu,
              żeby odpowiadać bardziej konkretnie.
            </p>
          </div>

          <div className="sug-grid">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                className="sug-card"
                onClick={() => send(s.text)}
              >
                <span className="sg-ico">
                  <Icon name={s.icon} size={17} />
                </span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="chat-box">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "user" : "bot"}`}>
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="typing">
            <i />
            <i />
            <i />
          </div>
        )}
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
        <button onClick={() => send()} disabled={busy} aria-label="Wyślij">
          <Icon name="send" size={19} />
        </button>
      </div>
    </div>
  );
}

function autoTitle(msg) {
  return msg.length <= 42 ? msg : msg.slice(0, 42) + "…";
}
