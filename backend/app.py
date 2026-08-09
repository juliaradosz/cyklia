# -*- coding: utf-8 -*-
import os
from datetime import date, datetime

from flask import Flask, jsonify, request
from flask_cors import CORS

import auth
import database as db
import cycle as cyc
from chat_bot import reply as chat_reply

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "frontend", "dist"))


def create_app():
    app = Flask(__name__)
    CORS(app)
    db.init_db()

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "name": "Cyklia API"})

    # ---------- Autoryzacja ----------

    @app.post("/api/register")
    def register():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        name = (data.get("display_name") or "").strip()
        if "@" not in email or len(email) < 5:
            return jsonify({"error": "Podaj poprawny adres e-mail"}), 400
        if len(password) < 6:
            return jsonify({"error": "Hasło musi mieć co najmniej 6 znaków"}), 400
        if db.query_one("SELECT id FROM users WHERE email = ?", (email,)):
            return jsonify({"error": "Konto z tym adresem już istnieje"}), 409
        uid = db.execute(
            "INSERT INTO users (email, password_hash, display_name, created_at) "
            "VALUES (?, ?, ?, ?)",
            (email, auth.hash_password(password), name or email.split("@")[0], db.now_iso()),
        )
        return jsonify({"token": auth.make_token(uid), "user": _user_payload(uid)}), 201

    @app.post("/api/login")
    def login():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        user = db.query_one("SELECT * FROM users WHERE email = ?", (email,))
        if not user or user["password_hash"] != auth.hash_password(password):
            return jsonify({"error": "Niepoprawny e-mail lub hasło"}), 401
        return jsonify({"token": auth.make_token(user["id"]), "user": _user_payload(user["id"])})

    @app.get("/api/me")
    @auth.auth_required
    def me(user_id):
        return jsonify(_user_payload(user_id))

    @app.patch("/api/me")
    @auth.auth_required
    def update_me(user_id):
        data = request.get_json(silent=True) or {}
        fields, args = [], []
        for key in ("display_name",):
            if key in data:
                fields.append(f"{key} = ?")
                args.append(str(data[key]))
        for key in ("cycle_length_default", "period_length_default"):
            if key in data and isinstance(data[key], int) and 14 <= data[key] <= 60:
                fields.append(f"{key} = ?")
                args.append(data[key])
        if "pill_mode" in data:
            fields.append("pill_mode = ?")
            args.append(1 if data["pill_mode"] else 0)
        if "pill_cycle_days" in data and isinstance(data["pill_cycle_days"], int):
            fields.append("pill_cycle_days = ?")
            args.append(max(1, min(30, data["pill_cycle_days"])))
        if "pill_break_days" in data and isinstance(data["pill_break_days"], int):
            fields.append("pill_break_days = ?")
            args.append(max(0, min(14, data["pill_break_days"])))
        if "pill_name" in data:
            fields.append("pill_name = ?")
            args.append(str(data.get("pill_name") or ""))
        if fields:
            args.append(user_id)
            db.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", tuple(args))
        return jsonify(_user_payload(user_id))

    # ---------- Antykoncepcja (informacyjna baza tabletek) ----------

    @app.get("/api/pills")
    def list_pills():
        import pills as pills_data

        return jsonify(pills_data.PILLS)

    # ---------- Cykle (okresy) ----------

    @app.get("/api/cycles")
    @auth.auth_required
    def list_cycles(user_id):
        rows = db.query(
            "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date DESC", (user_id,)
        )
        return jsonify(rows)

    @app.post("/api/cycles")
    @auth.auth_required
    def add_cycle(user_id):
        data = request.get_json(silent=True) or {}
        start = (data.get("start_date") or "").strip()
        end = (data.get("end_date") or "").strip() or None
        flow = data.get("flow_level", 1)
        try:
            datetime.strptime(start, "%Y-%m-%d")
        except (ValueError, TypeError):
            return jsonify({"error": "Podaj poprawną datę rozpoczęcia"}), 400
        cid = db.execute(
            "INSERT INTO cycles (user_id, start_date, end_date, flow_level) "
            "VALUES (?, ?, ?, ?)",
            (user_id, start, end, int(flow) if flow is not None else 1),
        )
        row = db.query_one("SELECT * FROM cycles WHERE id = ?", (cid,))
        return jsonify(row), 201

    @app.delete("/api/cycles/<int:cid>")
    @auth.auth_required
    def delete_cycle(user_id, cid):
        db.execute("DELETE FROM cycles WHERE id = ? AND user_id = ?", (cid, user_id))
        return jsonify({"ok": True})

    # ---------- Dziennik (wpisy dzienne) ----------

    @app.get("/api/entries")
    @auth.auth_required
    def list_entries(user_id):
        from_ = request.args.get("from")
        to_ = request.args.get("to")
        sql = "SELECT * FROM entries WHERE user_id = ?"
        args = [user_id]
        if from_:
            sql += " AND date >= ?"
            args.append(from_)
        if to_:
            sql += " AND date <= ?"
            args.append(to_)
        sql += " ORDER BY date DESC"
        return jsonify(db.query(sql, tuple(args)))

    @app.get("/api/entries/<day>")
    @auth.auth_required
    def get_entry(user_id, day):
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        row = db.query_one(
            "SELECT * FROM entries WHERE user_id = ? AND date = ?", (user_id, day)
        )
        return jsonify(row)

    @app.put("/api/entries/<day>")
    @auth.auth_required
    def upsert_entry(user_id, day):
        data = request.get_json(silent=True) or {}
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        existing = db.query_one(
            "SELECT id FROM entries WHERE user_id = ? AND date = ?", (user_id, day)
        )
        vals = {
            "temperature": data.get("temperature"),
            "mood": data.get("mood"),
            "symptoms": _to_json_list(data.get("symptoms")),
            "notes": data.get("notes"),
            "water": data.get("water"),
            "sleep": data.get("sleep"),
            "activity": data.get("activity"),
            "libido": data.get("libido"),
            "stress": data.get("stress"),
            "mucus": data.get("mucus"),
            "weight": data.get("weight"),
        }
        if existing:
            db.execute(
                "UPDATE entries SET temperature=?, mood=?, symptoms=?, notes=?, "
                "water=?, sleep=?, activity=?, libido=?, stress=?, mucus=?, weight=? "
                "WHERE id=?",
                (
                    vals["temperature"], vals["mood"], vals["symptoms"], vals["notes"],
                    vals["water"], vals["sleep"], vals["activity"], vals["libido"],
                    vals["stress"], vals["mucus"], vals["weight"], existing["id"],
                ),
            )
        else:
            db.execute(
                "INSERT INTO entries (user_id, date, temperature, mood, symptoms, notes, "
                "water, sleep, activity, libido, stress, mucus, weight) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    user_id, day, vals["temperature"], vals["mood"], vals["symptoms"],
                    vals["notes"], vals["water"], vals["sleep"], vals["activity"],
                    vals["libido"], vals["stress"], vals["mucus"], vals["weight"],
                ),
            )
        return jsonify(db.query_one("SELECT * FROM entries WHERE user_id = ? AND date = ?", (user_id, day)))

    @app.delete("/api/entries/<day>")
    @auth.auth_required
    def delete_entry(user_id, day):
        db.execute("DELETE FROM entries WHERE user_id = ? AND date = ?", (user_id, day))
        return jsonify({"ok": True})

    # ---------- Kalendarz i prognozy ----------

    @app.get("/api/calendar")
    @auth.auth_required
    def calendar(user_id):
        cycles = db.query(
            "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
        )
        user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
        starts = [c["start_date"] for c in cycles]
        ends = [c["end_date"] for c in cycles if c["end_date"]]
        pred = cyc.build_calendar(
            starts,
            cycle_length=user["cycle_length_default"],
            period_length=user["period_length_default"],
            pills=bool(user["pill_mode"]),
            pill_cycle=user["pill_cycle_days"] or 21,
            pill_break=user["pill_break_days"] or 7,
        )
        # zakres widoczny: od pierwszego wpisu do +90 dni w przyszłość
        min_day = min(starts) if starts else date.today().isoformat()
        max_day = (date.today() + __import__("datetime").timedelta(days=90)).isoformat()
        days = {}
        d = datetime.strptime(min_day, "%Y-%m-%d").date()
        last = datetime.strptime(max_day, "%Y-%m-%d").date()
        while d <= last:
            days[d.isoformat()] = cyc.day_type_for(d.isoformat(), starts, ends, pred)
            d += __import__("datetime").timedelta(days=1)
        return jsonify({"prediction": pred, "days": days})

    # ---------- Statystyki ----------

    @app.get("/api/stats")
    @auth.auth_required
    def stats(user_id):
        cycles = db.query(
            "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
        )
        entries = db.query(
            "SELECT * FROM entries WHERE user_id = ? ORDER BY date", (user_id,)
        )
        starts = sorted(set(c["start_date"] for c in cycles))
        lengths = [
            (datetime.strptime(b, "%Y-%m-%d").date() - datetime.strptime(a, "%Y-%m-%d").date()).days
            for a, b in zip(starts[:-1], starts[1:])
            if (datetime.strptime(b, "%Y-%m-%d").date() - datetime.strptime(a, "%Y-%m-%d").date()).days > 0
        ]
        period_lengths = []
        for c in cycles:
            if c["end_date"]:
                pl = (datetime.strptime(c["end_date"], "%Y-%m-%d").date()
                      - datetime.strptime(c["start_date"], "%Y-%m-%d").date()).days + 1
                if 1 <= pl <= 21:
                    period_lengths.append(pl)
        temps = [(e["date"], e["temperature"]) for e in entries if e["temperature"]]
        moods = {}
        for e in entries:
            if e["mood"]:
                moods[e["mood"]] = moods.get(e["mood"], 0) + 1
        symptoms = {}
        import json as _json

        for e in entries:
            try:
                syms = _json.loads(e["symptoms"])
            except (ValueError, TypeError):
                syms = []
            for s in syms:
                symptoms[s] = symptoms.get(s, 0) + 1
        return jsonify({
            "cycle_count": len(starts),
            "average_cycle": round(sum(lengths) / len(lengths), 1) if lengths else None,
            "average_period": round(sum(period_lengths) / len(period_lengths), 1) if period_lengths else None,
            "last_period_start": starts[-1] if starts else None,
            "temps": temps,
            "moods": moods,
            "symptoms": symptoms,
            "entry_count": len(entries),
        })

    # ---------- Artykuły ----------

    @app.get("/api/articles")
    def list_articles():
        rows = db.query("SELECT id, title, category, summary, created_at FROM articles ORDER BY id")
        return jsonify(rows)

    @app.get("/api/articles/<int:aid>")
    def get_article(aid):
        row = db.query_one("SELECT * FROM articles WHERE id = ?", (aid,))
        if not row:
            return jsonify({"error": "Nie znaleziono artykułu"}), 404
        return jsonify(row)

    # ---------- Czat ----------

    @app.get("/api/chat/history")
    @auth.auth_required
    def chat_history(user_id):
        rows = db.query(
            "SELECT role, content FROM chat_messages WHERE user_id = ? "
            "ORDER BY id DESC LIMIT 50",
            (user_id,),
        )
        rows.reverse()
        return jsonify(rows)

    @app.post("/api/chat")
    @auth.auth_required
    def chat(user_id):
        data = request.get_json(silent=True) or {}
        message = (data.get("message") or "").strip()
        if not message:
            return jsonify({"error": "Wiadomość nie może być pusta"}), 400
        history = [
            {"role": m["role"], "content": m["content"]}
            for m in db.query(
                "SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 10",
                (user_id,),
            )
        ]
        history.reverse()
        answer = chat_reply(message, history, _chat_context(user_id))
        db.execute(
            "INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?, 'user', ?, ?)",
            (user_id, message, db.now_iso()),
        )
        db.execute(
            "INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?, 'assistant', ?, ?)",
            (user_id, answer, db.now_iso()),
        )
        return jsonify({"reply": answer})

    # ---------- Serwowanie frontendu (po zbudowaniu) ----------

    if os.path.isdir(DIST_DIR):
        @app.get("/", defaults={"path": ""})
        @app.get("/<path:path>")
        def spa(path):
            if path.startswith("api/"):
                return jsonify({"error": "Nie znaleziono zasobu"}), 404
            full = os.path.normpath(os.path.join(DIST_DIR, path))
            if path and full.startswith(DIST_DIR) and os.path.isfile(full):
                return app.send_static_file(path)
            return app.send_static_file("index.html")

        app.static_folder = DIST_DIR

    return app


def _user_payload(user_id):
    u = db.query_one(
        "SELECT id, email, display_name, cycle_length_default, period_length_default, "
        "pill_mode, pill_cycle_days, pill_break_days, pill_name, created_at "
        "FROM users WHERE id = ?",
        (user_id,),
    )
    return u


def _chat_context(user_id):
    """Buduje kontekst z kalendarza użytkownika, by asystent mógł podać konkretne daty."""
    from datetime import timedelta

    cycles = db.query(
        "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
    )
    user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
    starts = [c["start_date"] for c in cycles]
    pred = cyc.build_calendar(
        starts,
        cycle_length=user["cycle_length_default"],
        period_length=user["period_length_default"],
        pills=bool(user["pill_mode"]),
        pill_cycle=user["pill_cycle_days"] or 21,
        pill_break=user["pill_break_days"] or 7,
    )
    today = date.today()
    cycle_day = None
    if starts:
        last_start = datetime.strptime(starts[-1], "%Y-%m-%d").date()
        if last_start <= today:
            cycle_day = (today - last_start).days + 1
    days_to_period = None
    if pred.get("next_period_start"):
        nxt = datetime.strptime(pred["next_period_start"], "%Y-%m-%d").date()
        days_to_period = (nxt - today).days
    today_type = None
    if starts or pred.get("on_pills"):
        ends = [c["end_date"] for c in cycles if c["end_date"]]
        today_type = cyc.day_type_for(today.isoformat(), starts, ends, pred)
    return {
        "on_pills": bool(user["pill_mode"]),
        "next_period_start": pred.get("next_period_start"),
        "ovulation_date": pred.get("ovulation_date"),
        "fertile_start": pred.get("fertile_start"),
        "fertile_end": pred.get("fertile_end"),
        "cycle_length": pred.get("cycle_length"),
        "cycle_day": cycle_day,
        "days_to_period": days_to_period,
        "today_type": today_type,
    }


def _to_json_list(value):
    import json

    if isinstance(value, list):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, str):
        try:
            json.loads(value)
            return value
        except ValueError:
            return json.dumps([value], ensure_ascii=False)
    return "[]"


app = create_app()

if __name__ == "__main__":
    db.init_db()
    import seed as seed_data

    seed_data.seed()
    app.run(host="127.0.0.1", port=5000, debug=True)
