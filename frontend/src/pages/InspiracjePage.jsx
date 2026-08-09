import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useCalendar } from "../hooks.js";
import Icon from "../components/Icon.jsx";
import {
  CATEGORY_ORDER,
  categoryMeta,
  emojiFor,
  toneFor,
  currentPhase,
  PHASE_INFO,
  recommendedArticles,
  filterArticles,
} from "../inspiration.js";

function Card({ article }) {
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
    <Link to={`/inspiracje/${article.id}`} className="insp-card" style={{ background: tone.g }}>
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

function Chips({ options, value, onChange }) {
  return (
    <div className="cat-chips">
      {options.map((o) => (
        <button
          key={o.key}
          className={`cat-chip${value === o.key ? " on" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.emoji && <span className="cc-emoji">{o.emoji}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function InspiracjePage() {
  const { data: cal } = useCalendar();
  const [articles, setArticles] = useState([]);
  const [query, setQuery] = useState("");
  const [savedList, setSavedList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [cat, setCat] = useState("wszystkie");

  useEffect(() => {
    api("/articles")
      .then(setArticles)
      .catch(() => {})
      .finally(() => setLoaded(true));
    api("/saved-articles")
      .then(setSavedList)
      .catch(() => setSavedList([]));
  }, []);

  const phase = currentPhase(cal);
  const phaseInfo = PHASE_INFO[phase] || {
    emoji: "🌸",
    name: "Poznaj swój cykl",
    headline: "Wiedza o Twoim cyklu",
    desc: "Artykuły dopasowane do etapu Twojego cyklu, o którym mówi kalendarz.",
  };

  const filtered = useMemo(
    () => filterArticles(articles, query),
    [articles, query]
  );
  const forYou = useMemo(
    () => recommendedArticles(articles, cal),
    [articles, cal]
  );

  const chips = [
    { key: "wszystkie", label: "Wszystkie", emoji: "✨" },
    { key: "zapisane", label: "Zapisane", emoji: "♥" },
    ...CATEGORY_ORDER.map((c) => ({
      key: c,
      label: c,
      emoji: categoryMeta(c).emoji,
    })),
  ];

  let shown = [];
  let shownTag = "Wszystkie inspiracje";
  if (cat === "zapisane") {
    shown = savedList;
    shownTag = "Zapisane";
  } else if (cat === "wszystkie") {
    shown = articles;
  } else {
    shown = articles.filter((a) => a.category === cat);
    shownTag = cat;
  }

  if (!loaded) return <div className="center-screen">Ładowanie…</div>;

  return (
    <div className="inspiracje">
      <div className="page-header">
        <div>
          <h1>Inspiracje</h1>
          <div className="sub">Biblioteka wiedzy o cyklu i zdrowiu</div>
        </div>
      </div>

      <div className="for-you">
        <div className="for-you-head">
          <span className="for-you-emoji">{phaseInfo.emoji}</span>
          <div>
            <div className="for-you-label">Dla Ciebie · {phaseInfo.name}</div>
            <div className="for-you-title">{phaseInfo.headline}</div>
            <div className="for-you-desc">{phaseInfo.desc}</div>
          </div>
        </div>
        {forYou.length > 0 && (
          <div className="insp-row">
            {forYou.map((a) => (
              <Card key={a.id} article={a} />
            ))}
          </div>
        )}
      </div>

      <div className="search-wrap">
        <span className="search-ico">
          <Icon name="search" size={18} />
        </span>
        <input
          className="search-input"
          placeholder="Czego chcesz się dowiedzieć?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery("")}>
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {query ? (
        <div>
          <div className="muted" style={{ marginBottom: 12 }}>
            {filtered.length} {filtered.length === 1 ? "wynik" : "wyników"} dla „{query}”
          </div>
          <div className="insp-grid">
            {filtered.map((a) => (
              <Card key={a.id} article={a} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <Chips options={chips} value={cat} onChange={setCat} />
          {cat === "zapisane" && savedList.length === 0 ? (
            <p className="muted">Zapisz artykuły serduszkiem, by mieć je pod ręką.</p>
          ) : (
            <>
              <div className="cat-head" style={{ marginBottom: 12 }}>
                <span className="cat-emoji">
                  {chips.find((c) => c.key === cat)?.emoji || "✨"}
                </span>
                <div>
                  <h2>{shownTag}</h2>
                  <div className="cat-tagline">
                    {shown.length} {shown.length === 1 ? "artykuł" : "artykułów"}
                  </div>
                </div>
              </div>
              <div className="insp-grid">
                {shown.map((a) => (
                  <Card key={a.id} article={a} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
