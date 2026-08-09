import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client.js";

export default function ArticlePage() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);

  useEffect(() => {
    api(`/articles/${id}`)
      .then(setArticle)
      .catch(() => {});
  }, [id]);

  if (!article) return <div className="center-screen">Ładowanie…</div>;

  return (
    <div>
      <p className="muted">
        <Link to="/artykuly">← Wszystkie artykuły</Link>
      </p>
      <div className="card">
        <div className="tag">{article.category}</div>
        <h2 style={{ marginTop: 8 }}>{article.title}</h2>
        <div className="article-body">{article.content}</div>
      </div>
      <div className="card">
        <h3>Porozmawiaj z asystentem</h3>
        <p className="muted">
          Masz pytania o ten temat? Zapytaj darmowego asystenta AI.
        </p>
        <Link to="/czat" className="btn small">
          💬 Zadaj pytanie
        </Link>
      </div>
    </div>
  );
}
