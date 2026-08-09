import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { CATEGORY_ORDER, categoryMeta } from "../inspiration.js";
import InspCard from "../components/InspCard.jsx";
import Icon from "../components/Icon.jsx";

export default function InspiracjeCategoryPage() {
  const { category } = useParams();
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const catName = decodeURIComponent(category || "");
  const meta = categoryMeta(catName);

  useEffect(() => {
    api("/articles")
      .then(setArticles)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const items = useMemo(
    () => articles.filter((a) => a.category === catName),
    [articles, catName]
  );

  const prev = useMemo(() => {
    const i = CATEGORY_ORDER.indexOf(catName);
    if (i > 0) return CATEGORY_ORDER[i - 1];
    return null;
  }, [catName]);
  const next = useMemo(() => {
    const i = CATEGORY_ORDER.indexOf(catName);
    if (i >= 0 && i < CATEGORY_ORDER.length - 1) return CATEGORY_ORDER[i + 1];
    return null;
  }, [catName]);

  if (!loaded) return <div className="center-screen">Ładowanie…</div>;

  return (
    <div className="insp-category">
      <div className="sub-screen-head">
        <button
          className="icon-btn"
          onClick={() => navigate("/inspiracje")}
          aria-label="Wróć"
        >
          <Icon name="chevron-left" size={20} />
        </button>
        <h1>{catName}</h1>
      </div>

      <div className="cat-hero">
        <span className="cat-hero-emoji">{meta.emoji}</span>
        <div className="cat-hero-body">
          <div className="cat-hero-tagline">{meta.tagline}</div>
          <div className="cat-hero-count">
            {items.length} {items.length === 1 ? "artykuł" : "artykułów"}
          </div>
        </div>
      </div>

      <div className="insp-grid">
        {items.map((a) => (
          <InspCard key={a.id} article={a} />
        ))}
      </div>

      {(prev || next) && (
        <div className="cat-nav">
          {prev ? (
            <button
              className="cat-nav-btn"
              onClick={() => navigate(`/inspiracje/kategoria/${encodeURIComponent(prev)}`)}
            >
              <Icon name="chevron-left" size={16} /> {categoryMeta(prev).emoji} {prev}
            </button>
          ) : (
            <span />
          )}
          {next ? (
            <button
              className="cat-nav-btn right"
              onClick={() => navigate(`/inspiracje/kategoria/${encodeURIComponent(next)}`)}
            >
              {categoryMeta(next).emoji} {next} <Icon name="chevron-right" size={16} />
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
