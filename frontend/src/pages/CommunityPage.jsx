import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../api/auth.jsx";

const CATS = ["Ogólne", "Pytania i porady", "Doświadczenia", "Wsparcie"];

function timeAgo(isoDate) {
  const ms = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  return `${d} dni temu`;
}

export default function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", category: "Ogólne" });
  const [busy, setBusy] = useState(false);
  const [openPost, setOpenPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");

  async function load() {
    try {
      setPosts(await api("/posts"));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitPost(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/posts", { method: "POST", body: form });
      setForm({ title: "", body: "", category: "Ogólne" });
      setShowForm(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function open(p) {
    setOpenPost(p);
    try {
      setComments(await api(`/posts/${p.id}/comments`));
    } catch {
      setComments([]);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    await api(`/posts/${openPost.id}/comments`, {
      method: "POST",
      body: { body: comment },
    });
    setComment("");
    setComments(await api(`/posts/${openPost.id}/comments`));
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Społeczność</h1>
          <div className="sub">Wymiana doświadczeń, wsparcie i pytania</div>
        </div>
        <button className="btn small" onClick={() => setShowForm(!showForm)}>
          + Nowy wpis
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={submitPost}>
          <div className="field">
            <label>Temat</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Tytuł wpisu"
              required
            />
          </div>
          <div className="field">
            <label>Treść</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Podziel się doświadczeniem lub zadaj pytanie…"
              required
            />
          </div>
          <div className="field">
            <label>Kategoria</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <button className="btn block" disabled={busy}>
            Opublikuj
          </button>
        </form>
      )}

      {posts.length === 0 && (
        <p className="muted center">Brak wpisów. Bądź pierwszą osobą, która się podzieli!</p>
      )}

      {posts.map((p) => (
        <div key={p.id} className="post-card" onClick={() => open(p)}>
          <div className="meta">
            <span className="tag">{p.category}</span>
            <span>{p.author}</span>
            <span>· {timeAgo(p.created_at)}</span>
            <span>💬 {p.comment_count}</span>
          </div>
          <h3>{p.title}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {p.body.length > 140 ? p.body.slice(0, 140) + "…" : p.body}
          </p>
        </div>
      ))}

      {openPost && (
        <div className="modal-mask" onClick={() => setOpenPost(null)}>
          <div
            className="card modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="meta">
              <span className="tag">{openPost.category}</span>
              <span>{openPost.author}</span>
              <span>· {timeAgo(openPost.created_at)}</span>
            </div>
            <h2>{openPost.title}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{openPost.body}</p>
            <hr style={{ border: "none", borderTop: "1px solid var(--line)" }} />
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <span className="who">{c.author} · {timeAgo(c.created_at)}</span>
                <p style={{ margin: "4px 0 0" }}>{c.body}</p>
              </div>
            ))}
            <form onSubmit={submitComment} className="row mt">
              <input
                style={{ flex: 1 }}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={`Komentuj jako ${user?.display_name || "gość"}…`}
              />
              <button className="btn small">➤</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
