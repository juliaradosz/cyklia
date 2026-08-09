import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

const PROMPTS = [
  "Kiedy mam okres?",
  "Kiedy mam owulację?",
  "Kiedy są moje dni płodne?",
  "Który to dzień mojego cyklu?",
  "Co pomaga na PMS?",
  "Jak mierzyć temperaturę?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Cześć! Jestem Twoim darmowym asystentem Cyklia. 🙂 Znam Twój kalendarz, więc mogę powiedzieć np. kiedy przewiduję Twój kolejny okres. Kliknij podpowiedź albo napisz własne pytanie.",
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
