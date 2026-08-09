# -*- coding: utf-8 -*-
"""
Seedowanie biblioteki artykułów (sekcja Inspiracje).
Upsert po slug — można uruchamiać wielokrotnie; starsze artykuły bez sluga
(przed rozbudową biblioteki) są usuwane. Zapisane artykuły użytkowniczek
(user_articles) zostają aktualizowane automatycznie, bo odwołują się do id.
"""
import json

import database as db
import articles_library as library


def _dump(value):
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return value or ""


def _article_row(a, aid=None):
    content = a["content"]
    return (
        a["slug"],
        a["title"],
        a["category"],
        a["summary"],
        a.get("intro", ""),
        int(a.get("read_minutes", 5)),
        a.get("illustration", "bloom"),
        a.get("tone", "rose"),
        a.get("badge", ""),
        a.get("phase", "any"),
        a.get("keywords", ""),
        _dump(a.get("related", [])),
        _dump(content),
        db.now_iso(),
    )


def seed_articles():
    db.init_db()
    for a in library.ARTICLES:
        existing = db.query_one("SELECT id FROM articles WHERE slug = ?", (a["slug"],))
        row = _article_row(a)
        if existing:
            db.execute(
                "UPDATE articles SET slug=?, title=?, category=?, summary=?, intro=?, "
                "read_minutes=?, illustration=?, tone=?, badge=?, phase=?, keywords=?, "
                "related=?, content=?, created_at=? WHERE id=?",
                row + (existing["id"],),
            )
        else:
            db.execute(
                "INSERT INTO articles (slug, title, category, summary, intro, "
                "read_minutes, illustration, tone, badge, phase, keywords, related, "
                "content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                row,
            )
    # usuń stare artykuły sprzed rozbudowy (bez sluga)
    db.execute("DELETE FROM articles WHERE slug IS NULL OR slug = ''")
    return len(library.ARTICLES)


def seed():
    n = seed_articles()
    print(f"Biblioteka Inspiracji: {n} artykułów zsynchronizowanych.")


if __name__ == "__main__":
    seed()
