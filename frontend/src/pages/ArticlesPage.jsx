import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

export default function ArticlesPage() {
  const [articles, setArticles] = useState([]);
  const [cat, setCat] = useState("");

  useEffect(() => {
    api("/articles")
      .then(setArticles)
      .catch(() => {});
  }, []);

  const cats = [...new Set(articles.map((a) => a.category))];
  const list = cat ? articles.filter((a) => a.category === cat) : articles;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Artykuły</h1>
          <div className="sub">Wiedza o cyklu i zdrowiu</div>
        </div>
      </div>

      <div className="seg">
        <button className={cat === "" ? "on" : ""} onClick={() => setCat("")}>
          Wszystkie
        </button>
        {cats.map((c) => (
          <button
            key={c}
            className={cat === c ? "on" : ""}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {list.map((a) => (
        <Link key={a.id} to={`/artykuly/${a.id}`} className="article-card">
          <div className="cat">{a.category}</div>
          <h3>{a.title}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {a.summary}
          </p>
        </Link>
      ))}
    </div>
  );
}
