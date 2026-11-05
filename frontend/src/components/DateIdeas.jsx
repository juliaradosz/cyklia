import { useState } from "react";
import Icon from "./Icon.jsx";

const MOOD_LABEL = { cozy: "w domu", active: "aktywnie", out: "na mieście" };
const PAGE = 3;

// Pomysły na randkę — po 3 naraz, przycisk „Inne pomysły” pokazuje kolejne.
export default function DateIdeas({ ideas, hint }) {
  const [page, setPage] = useState(0);
  if (!ideas || !ideas.length) return null;
  const pages = Math.ceil(ideas.length / PAGE);
  const shown = ideas.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div className="j-section">
      <div className="j-sec-head">
        <span className="js-ico">
          <Icon name="sparkles" size={17} />
        </span>
        <b>Pomysł na randkę</b>
      </div>
      {hint && (
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          {hint}
        </p>
      )}
      <div className="idea-list">
        {shown.map((it) => (
          <div key={it.title} className="idea">
            <span className="idea-emoji">{it.emoji}</span>
            <div className="idea-body">
              <b>{it.title}</b>
              <span>{it.text}</span>
              <span className="idea-meta">
                {MOOD_LABEL[it.mood]} · {it.cost}
                {it.fits ? " · pasuje do dzisiejszej fazy" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
      <button className="btn ghost block mt" onClick={() => setPage((page + 1) % pages)}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="repeat" size={16} /> Inne pomysły
        </span>
      </button>
    </div>
  );
}
