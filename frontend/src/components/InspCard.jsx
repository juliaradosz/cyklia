import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { emojiFor, toneFor } from "../inspiration.js";

export default function InspCard({ article }) {
  const tone = toneFor(article);
  const [saved, setSaved] = useState(!!article.saved);

  async function toggleSave(e) {
    e.preventDefault();
    const next = !saved;
    setSaved(next);
    try {
      const res = await api(`/articles/${article.id}/save`, { method: "POST" });
      setSaved(res.saved);
    } catch {
      setSaved(!next);
    }
  }

  return (
    <Link
      to={`/inspiracje/${article.id}`}
      className="insp-card"
      style={{ background: tone.g }}
    >
      <div className="insp-ill">
        <span className="insp-emoji">{emojiFor(article)}</span>
        <button
          className={`save-btn ${saved ? "saved" : ""}`}
          onClick={toggleSave}
          aria-label={saved ? "Usuń z zapisanych" : "Zapisz artykuł"}
        >
          {saved ? "♥" : "♡"}
        </button>
      </div>
      {article.badge && <span className="insp-badge">{article.badge}</span>}
      <h3 className="insp-title">{article.title}</h3>
      <div className="insp-meta">
        {article.read_minutes} min · {article.category}
      </div>
    </Link>
  );
}
