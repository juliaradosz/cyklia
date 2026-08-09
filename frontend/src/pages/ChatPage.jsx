import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

const SUGGESTIONS = [
  "Co to jest owulacja?",
  "Mam objawy PMS, co pomaga?",
  "Jak mierzyć temperaturę bazową?",
  "Kiedy są moje dni płodne?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Cześć! Jestem Twoim darmowym asystentem Cyklia. 🙂 Pytaj o cykl, owulację, PMS, temperaturę, sen i zdrowie. To informacje edukacyjne — nie zastępują wizyty u lekarza.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef(null);

  useEffect(() => {
    api("/chat/history")
      .then((rows) => {
        if (rows.length) setMessages(rows);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api("/chat", { method: "POST", body: { message: msg } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Asystent AI</h1>
          <div className="sub">Darmowy — pyta o wszystko bez ograniczeń</div>
        </div>
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

      {messages.length <= 1 && (
        <div className="chips mb">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

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
