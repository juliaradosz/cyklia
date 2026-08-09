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
        if "pill_time" in data:
            t = str(data.get("pill_time") or "12:00").strip()
            try:
                datetime.strptime(t, "%H:%M")
            except ValueError:
                t = "12:00"
            fields.append("pill_time = ?")
            args.append(t)
        if fields:
            args.append(user_id)
            db.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", tuple(args))
        return jsonify(_user_payload(user_id))

    # ---------- Antykoncepcja (informacyjna baza tabletek) ----------

    @app.get("/api/pills")
    def list_pills():
        import pills as pills_data

        return jsonify(pills_data.PILLS)

    # ---------- Tabletki — dzienny log (czy wzięta i o której) ----------

    @app.get("/api/pills/log/dates")
    @auth.auth_required
    def list_pill_log_dates(user_id):
        rows = db.query(
            "SELECT date FROM pill_logs WHERE user_id = ? ORDER BY date", (user_id,)
        )
        return jsonify({"dates": [r["date"] for r in rows]})

    @app.get("/api/pills/log")
    @auth.auth_required
    def get_pill_log(user_id):
        day = request.args.get("date") or date.today().isoformat()
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        return jsonify(_pill_status(user_id, day))

    @app.post("/api/pills/log")
    @auth.auth_required
    def mark_pill_taken(user_id):
        data = request.get_json(silent=True) or {}
        day = data.get("date") or date.today().isoformat()
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        taken_at = (data.get("time") or datetime.now().strftime("%H:%M")).strip()
        try:
            datetime.strptime(taken_at, "%H:%M")
        except ValueError:
            return jsonify({"error": "Podaj godzinę w formacie HH:MM"}), 400
        if not _pill_status(user_id, day)["needs_log"]:
            return jsonify({"error": "Dziś jest dzień przerwy — nie przyjmujesz tabletki."}), 400
        db.execute(
            "INSERT INTO pill_logs (user_id, date, taken_at, created_at) "
            "VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id, date) DO UPDATE SET taken_at = excluded.taken_at",
            (user_id, day, taken_at, db.now_iso()),
        )
        return jsonify(_pill_status(user_id, day))

    @app.delete("/api/pills/log")
    @auth.auth_required
    def unmark_pill(user_id):
        data = request.get_json(silent=True) or {}
        day = data.get("date") or date.today().isoformat()
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        db.execute(
            "DELETE FROM pill_logs WHERE user_id = ? AND date = ?", (user_id, day)
        )
        return jsonify(_pill_status(user_id, day))

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

    @app.patch("/api/cycles/<int:cid>")
    @auth.auth_required
    def update_cycle(user_id, cid):
        row = db.query_one(
            "SELECT * FROM cycles WHERE id = ? AND user_id = ?", (cid, user_id)
        )
        if not row:
            return jsonify({"error": "Nie znaleziono okresu"}), 404
        data = request.get_json(silent=True) or {}
        fields, args = [], []
        for key in ("start_date", "end_date"):
            if key in data:
                val = (data[key] or "").strip() or None
                if val is not None:
                    try:
                        datetime.strptime(val, "%Y-%m-%d")
                    except ValueError:
                        return jsonify({"error": "Nieprawidłowa data"}), 400
                fields.append(f"{key} = ?")
                args.append(val)
        if "flow_level" in data:
            fields.append("flow_level = ?")
            args.append(int(data["flow_level"]) if data["flow_level"] is not None else 1)
        if not fields:
            return jsonify(row)
        args.append(cid)
        db.execute(f"UPDATE cycles SET {', '.join(fields)} WHERE id = ? AND user_id = ?", tuple(args + [user_id]))
        return jsonify(db.query_one("SELECT * FROM cycles WHERE id = ?", (cid,)))

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
            "steps": data.get("steps"),
            "sleep_quality": data.get("sleep_quality"),
            "sex": _to_json_list(data.get("sex")) if data.get("sex") is not None else None,
        }
        if existing:
            db.execute(
                "UPDATE entries SET temperature=?, mood=?, symptoms=?, notes=?, "
                "water=?, sleep=?, activity=?, libido=?, stress=?, mucus=?, weight=?, "
                "steps=?, sleep_quality=?, sex=? "
                "WHERE id=?",
                (
                    vals["temperature"], vals["mood"], vals["symptoms"], vals["notes"],
                    vals["water"], vals["sleep"], vals["activity"], vals["libido"],
                    vals["stress"], vals["mucus"], vals["weight"], vals["steps"],
                    vals["sleep_quality"], vals["sex"], existing["id"],
                ),
            )
        else:
            db.execute(
                "INSERT INTO entries (user_id, date, temperature, mood, symptoms, notes, "
                "water, sleep, activity, libido, stress, mucus, weight, steps, sleep_quality, sex) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    user_id, day, vals["temperature"], vals["mood"], vals["symptoms"],
                    vals["notes"], vals["water"], vals["sleep"], vals["activity"],
                    vals["libido"], vals["stress"], vals["mucus"], vals["weight"],
                    vals["steps"], vals["sleep_quality"], vals["sex"],
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
            pill_break=(user["pill_break_days"] if user["pill_break_days"] is not None else 7),
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
        import json as _json

        moods = {}
        for e in entries:
            if not e["mood"]:
                continue
            keys = e["mood"]
            if isinstance(keys, str) and keys.strip().startswith("["):
                try:
                    keys = _json.loads(keys)
                except (ValueError, TypeError):
                    keys = [e["mood"]]
            if not isinstance(keys, list):
                keys = [keys]
            for k in keys:
                if k:
                    moods[k] = moods.get(k, 0) + 1
        symptoms = {}

        for e in entries:
            try:
                syms = _json.loads(e["symptoms"])
            except (ValueError, TypeError):
                syms = []
            for s in syms:
                symptoms[s] = symptoms.get(s, 0) + 1
        sleeps = [e["sleep"] for e in entries if e["sleep"] is not None]
        activities = [e["activity"] for e in entries if e["activity"] is not None]
        steps_list = [e["steps"] for e in entries if e["steps"]]

        user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
        pred = cyc.build_calendar(
            starts,
            cycle_length=user["cycle_length_default"],
            period_length=user["period_length_default"],
            pills=bool(user["pill_mode"]),
            pill_cycle=user["pill_cycle_days"] or 21,
            pill_break=(user["pill_break_days"] if user["pill_break_days"] is not None else 7),
        )
        phase_order = (
            ["Aktywne dni", "Przerwa"]
            if pred.get("on_pills")
            else ["Okres", "Faza folikularna", "Faza lutealna"]
        )
        agg = {}
        for e in entries:
            ph = _entry_phase(
                e["date"], pred, starts, period_length=user["period_length_default"]
            )
            if not ph:
                continue
            d = agg.setdefault(ph, {"count": 0, "sleep": [], "steps": [], "activity": []})
            d["count"] += 1
            if e["sleep"] is not None:
                d["sleep"].append(e["sleep"])
            if e["steps"]:
                d["steps"].append(e["steps"])
            if e["activity"] is not None:
                d["activity"].append(e["activity"])
        phases = [
            {
                "phase": ph,
                "count": agg[ph]["count"],
                "sleep": round(sum(agg[ph]["sleep"]) / len(agg[ph]["sleep"]), 1) if agg[ph]["sleep"] else None,
                "steps": round(sum(agg[ph]["steps"]) / len(agg[ph]["steps"])) if agg[ph]["steps"] else None,
                "activity": round(sum(agg[ph]["activity"]) / len(agg[ph]["activity"])) if agg[ph]["activity"] else None,
            }
            for ph in phase_order
            if ph in agg
        ]
        sleep_trend = [
            [e["date"], e["sleep"]] for e in entries if e["sleep"] is not None
        ][-14:]
        steps_trend = [[e["date"], e["steps"]] for e in entries if e["steps"]][-14:]
        return jsonify({
            "cycle_count": len(starts),
            "average_cycle": round(sum(lengths) / len(lengths), 1) if lengths else None,
            "average_period": round(sum(period_lengths) / len(period_lengths), 1) if period_lengths else None,
            "last_period_start": starts[-1] if starts else None,
            "temps": temps,
            "moods": moods,
            "symptoms": symptoms,
            "entry_count": len(entries),
            "average_sleep": round(sum(sleeps) / len(sleeps), 1) if sleeps else None,
            "average_activity": round(sum(activities) / len(activities), 1) if activities else None,
            "total_steps": sum(steps_list),
            "phases": phases,
            "sleep_trend": sleep_trend,
            "steps_trend": steps_trend,
        })

    # ---------- Artykuły (sekcja Inspiracje) ----------

    @app.get("/api/inspirations")
    @auth.auth_required
    def daily_inspirations(user_id):
        today = date.today().isoformat()
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
            pill_break=(user["pill_break_days"] if user["pill_break_days"] is not None else 7),
        )
        target = "any"
        if (
            not pred.get("on_pills")
            and pred.get("has_data")
            and pred.get("fertile_start")
            and pred.get("fertile_end")
            and pred["fertile_start"] <= today <= pred["fertile_end"]
        ):
            target = "ovulation"
        else:
            ph = _entry_phase(
                today, pred, starts, period_length=user["period_length_default"]
            )
            target = {
                "Okres": "period",
                "Przerwa": "period",
                "Faza lutealna": "luteal",
            }.get(ph, "any")
        rows = db.query(
            "SELECT id, slug, title, category, summary, read_minutes, badge, "
            "tone, illustration, phase FROM articles ORDER BY id"
        )
        saved = _saved_ids(user_id)
        matched = [r for r in rows if r["phase"] == target]
        matched_ids = {r["id"] for r in matched}
        fallback = [r for r in rows if r["phase"] == "any" and r["id"] not in matched_ids]
        picks = (matched + fallback)[:4]
        return jsonify([dict(r, saved=r["id"] in saved) for r in picks])

    @app.get("/api/articles")
    def list_articles():
        uid = _optional_user_id()
        saved = _saved_ids(uid) if uid else set()
        rows = db.query(
            "SELECT id, slug, title, category, summary, intro, read_minutes, "
            "illustration, tone, badge, phase, keywords, related, created_at "
            "FROM articles ORDER BY category, id"
        )
        out = []
        for r in rows:
            m = dict(r)
            m["saved"] = m["id"] in saved
            m["related"] = _parse_json(m.get("related"), [])
            out.append(m)
        return jsonify(out)

    @app.get("/api/articles/<int:aid>")
    def get_article(aid):
        uid = _optional_user_id()
        row = db.query_one("SELECT * FROM articles WHERE id = ?", (aid,))
        if not row:
            return jsonify({"error": "Nie znaleziono artykułu"}), 404
        out = dict(row)
        out["content"] = _parse_json(out.get("content"), {})
        out["related"] = _parse_json(out.get("related"), [])
        out["saved"] = bool(uid) and db.query_one(
            "SELECT 1 AS x FROM user_articles WHERE user_id = ? AND article_id = ?",
            (uid, aid),
        ) is not None
        return jsonify(out)

    @app.post("/api/articles/<int:aid>/save")
    @auth.auth_required
    def toggle_saved(user_id, aid):
        row = db.query_one("SELECT id FROM articles WHERE id = ?", (aid,))
        if not row:
            return jsonify({"error": "Nie znaleziono artykułu"}), 404
        existing = db.query_one(
            "SELECT id FROM user_articles WHERE user_id = ? AND article_id = ?",
            (user_id, aid),
        )
        if existing:
            db.execute("DELETE FROM user_articles WHERE id = ?", (existing["id"],))
            return jsonify({"saved": False})
        db.execute(
            "INSERT INTO user_articles (user_id, article_id, saved_at) VALUES (?, ?, ?)",
            (user_id, aid, db.now_iso()),
        )
        return jsonify({"saved": True})

    @app.get("/api/saved-articles")
    @auth.auth_required
    def list_saved(user_id):
        rows = db.query(
            "SELECT a.id, a.slug, a.title, a.category, a.summary, a.intro, "
            "a.read_minutes, a.illustration, a.tone, a.badge, a.phase, a.keywords, "
            "a.related, ua.saved_at AS saved_at "
            "FROM user_articles ua JOIN articles a ON a.id = ua.article_id "
            "WHERE ua.user_id = ? ORDER BY ua.saved_at DESC",
            (user_id,),
        )
        out = []
        for r in rows:
            m = dict(r)
            m["saved"] = True
            m["related"] = _parse_json(m.get("related"), [])
            out.append(m)
        return jsonify(out)

    # ---------- Czat (rozmowy) ----------

    @app.get("/api/chat/sessions")
    @auth.auth_required
    def chat_sessions(user_id):
        _ensure_chat_sessions(user_id)
        rows = db.query(
            "SELECT s.id, s.title, s.created_at, s.updated_at, "
            "(SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS msg_count, "
            "(SELECT content FROM chat_messages m WHERE m.session_id = s.id "
            "ORDER BY m.id DESC LIMIT 1) AS last_message "
            "FROM chat_sessions s WHERE s.user_id = ? ORDER BY s.updated_at DESC",
            (user_id,),
        )
        return jsonify(rows)

    @app.post("/api/chat/sessions")
    @auth.auth_required
    def create_chat_session(user_id):
        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip() or "Nowa rozmowa"
        now = db.now_iso()
        sid = db.execute(
            "INSERT INTO chat_sessions (user_id, title, created_at, updated_at) "
            "VALUES (?, ?, ?, ?)",
            (user_id, title, now, now),
        )
        welcome = (
            "Cześć! Jestem Twoim darmowym asystentem Cyklia. 🙂 Znam Twój "
            "kalendarz, więc mogę powiedzieć np. kiedy przewiduję Twój kolejny "
            "okres. O czym chcesz porozmawiać?"
        )
        db.execute(
            "INSERT INTO chat_messages (user_id, session_id, role, content, created_at) "
            "VALUES (?, ?, 'assistant', ?, ?)",
            (user_id, sid, welcome, now),
        )
        return jsonify({
            "id": sid, "title": title, "created_at": now, "updated_at": now,
            "msg_count": 1, "last_message": welcome,
        }), 201

    @app.get("/api/chat/sessions/<int:sid>")
    @auth.auth_required
    def chat_session_messages(user_id, sid):
        sess = _get_chat_session(user_id, sid)
        if not sess:
            return jsonify({"error": "Nie znaleziono rozmowy"}), 404
        rows = db.query(
            "SELECT role, content FROM chat_messages WHERE session_id = ? "
            "ORDER BY id ASC LIMIT 200",
            (sid,),
        )
        return jsonify({"id": sid, "title": sess["title"], "messages": rows})

    @app.post("/api/chat/sessions/<int:sid>")
    @auth.auth_required
    def chat_session_send(user_id, sid):
        sess = _get_chat_session(user_id, sid)
        if not sess:
            return jsonify({"error": "Nie znaleziono rozmowy"}), 404
        data = request.get_json(silent=True) or {}
        message = (data.get("message") or "").strip()
        if not message:
            return jsonify({"error": "Wiadomość nie może być pusta"}), 400
        answer = _chat_send(user_id, sid, message)
        return jsonify({"reply": answer})

    @app.patch("/api/chat/sessions/<int:sid>")
    @auth.auth_required
    def rename_chat_session(user_id, sid):
        sess = _get_chat_session(user_id, sid)
        if not sess:
            return jsonify({"error": "Nie znaleziono rozmowy"}), 404
        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip()
        if title:
            db.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (title, sid))
        return jsonify({"ok": True})

    @app.delete("/api/chat/sessions/<int:sid>")
    @auth.auth_required
    def delete_chat_session(user_id, sid):
        sess = _get_chat_session(user_id, sid)
        if not sess:
            return jsonify({"error": "Nie znaleziono rozmowy"}), 404
        db.execute("DELETE FROM chat_messages WHERE session_id = ?", (sid,))
        db.execute("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", (sid, user_id))
        return jsonify({"ok": True})

    # ---------- Czat: kompatybilność ze starą aplikacją (cache w przeglądarce) ----------

    @app.get("/api/chat/history")
    @auth.auth_required
    def chat_history_compat(user_id):
        _ensure_chat_sessions(user_id)
        sid = _latest_chat_session_id(user_id)
        rows = db.query(
            "SELECT role, content FROM chat_messages WHERE session_id = ? "
            "ORDER BY id DESC LIMIT 50",
            (sid,),
        )
        rows.reverse()
        return jsonify(rows)

    @app.post("/api/chat")
    @auth.auth_required
    def chat_compat(user_id):
        data = request.get_json(silent=True) or {}
        message = (data.get("message") or "").strip()
        if not message:
            return jsonify({"error": "Wiadomość nie może być pusta"}), 400
        _ensure_chat_sessions(user_id)
        sid = _latest_chat_session_id(user_id)
        answer = _chat_send(user_id, sid, message)
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
        "pill_mode, pill_cycle_days, pill_break_days, pill_name, pill_time, created_at "
        "FROM users WHERE id = ?",
        (user_id,),
    )
    return u


def _fmt_delay(minutes):
    hours = minutes / 60.0
    if hours == int(hours):
        return f"{int(hours)} godz."
    return f"ok. {hours:.1f}".replace(".", ",") + " godz."


def _pill_break_value(user):
    v = user.get("pill_break_days")
    return v if v is not None else 7


def _pill_status(user_id, day):
    """Status tabletki na dany dzień: czy trzeba przyjąć, czy już wzięta, czy spóźniona."""
    user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
    cycles = db.query(
        "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
    )
    starts = [c["start_date"] for c in cycles]
    ends = [c["end_date"] for c in cycles if c["end_date"]]
    on_pills = bool(user["pill_mode"])
    pred = cyc.build_calendar(
        starts,
        cycle_length=user["cycle_length_default"],
        period_length=user["period_length_default"],
        pills=on_pills,
        pill_cycle=user["pill_cycle_days"] or 21,
        pill_break=_pill_break_value(user),
    )
    day_type = cyc.day_type_for(day, starts, ends, pred) if on_pills else "normal"
    needs_log = on_pills and day_type != "period"
    log = db.query_one(
        "SELECT * FROM pill_logs WHERE user_id = ? AND date = ?", (user_id, day)
    )
    expected = user["pill_time"] or "12:00"
    threshold_h = 3 if _pill_break_value(user) == 0 else 12
    late = False
    warning = None
    taken_at = log["taken_at"] if log else None
    if taken_at:
        try:
            eh, em = (int(x) for x in expected.split(":"))
            th, tm = (int(x) for x in taken_at.split(":"))
            delta_min = (th * 60 + tm) - (eh * 60 + em)
            if delta_min < 0 and -delta_min > 6 * 60:
                delta_min += 24 * 60
            if delta_min > threshold_h * 60:
                late = True
        except (ValueError, AttributeError):
            delta_min = 0
        if late:
            warning = (
                f"Tabletka wzięta o {taken_at}, czyli {_fmt_delay(delta_min)} po zwykłej "
                f"porze ({expected}). Możliwy spadek skuteczności — sprawdź ulotkę "
                f"albo skonsultuj się z lekarzem."
            )
    return {
        "date": day,
        "on_pills": on_pills,
        "day_type": day_type,
        "needs_log": needs_log,
        "taken": bool(log),
        "taken_at": taken_at,
        "expected_time": expected,
        "threshold_hours": threshold_h,
        "late": late,
        "warning": warning,
    }


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
        pill_break=_pill_break_value(user),
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

    pill_name = user["pill_name"] or ""
    pill_type = None
    if pill_name:
        try:
            import pills as pills_data
            found = next((p for p in pills_data.PILLS if p["name"] == pill_name), None)
            if found:
                pill_type = found.get("type")
        except ImportError:
            pass

    return {
        "on_pills": bool(user["pill_mode"]),
        "pill_name": pill_name,
        "pill_type": pill_type,
        "pill_cycle_days": user["pill_cycle_days"] or 21,
        "pill_break_days": (user["pill_break_days"] if user["pill_break_days"] is not None else 7),
        "pill_time": user["pill_time"] or "12:00",
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


def _parse_json(value, default=None):
    import json

    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return default
    return default


def _entry_phase(day, prediction, cycle_starts, period_length=5):
    """Klasyfikuje dzień wpisu do fazy cyklu do korelacji w statystykach.

    Dla tabletek: aktywne dni vs przerwa. Dla naturalnego cyklu: faza liczona
    od ostatniej zarejestrowanej miesiączki (okres / folikularna / lutealna).
    """
    try:
        d = datetime.strptime(day, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    if prediction.get("on_pills"):
        day_type = cyc.day_type_for(day, cycle_starts, [], prediction)
        return "Przerwa" if day_type == "period" else "Aktywne dni"
    cycle = prediction.get("cycle_length") or 28
    period_len = int(period_length or 5)
    last = None
    for s in sorted(cycle_starts):
        try:
            sd = datetime.strptime(s, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        if sd <= d:
            last = sd
    if last is None:
        return None
    idx = (d - last).days
    if idx < period_len:
        return "Okres"
    if idx < cycle - 14:
        return "Faza folikularna"
    return "Faza lutealna"


def _optional_user_id():
    """Zwraca user_id, jeśli nagłówek zawiera poprawny token (opcjonalna autoryzacja)."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth.decode_token(auth_header[7:])
    return None


def _saved_ids(user_id):
    rows = db.query(
        "SELECT article_id FROM user_articles WHERE user_id = ?", (user_id,)
    )
    return {r["article_id"] for r in rows}


def _get_chat_session(user_id, sid):
    return db.query_one(
        "SELECT id, title FROM chat_sessions WHERE id = ? AND user_id = ?",
        (sid, user_id),
    )


def _latest_chat_session_id(user_id):
    sess = db.query_one(
        "SELECT id FROM chat_sessions WHERE user_id = ? "
        "ORDER BY updated_at DESC LIMIT 1",
        (user_id,),
    )
    if sess:
        return sess["id"]
    now = db.now_iso()
    return db.execute(
        "INSERT INTO chat_sessions (user_id, title, created_at, updated_at) "
        "VALUES (?, 'Nowa rozmowa', ?, ?)",
        (user_id, now, now),
    )


def _chat_send(user_id, sid, message):
    """Zapisuje wiadomość użytkownika, generuje odpowiedź i aktualizuje sesję."""
    sess = db.query_one(
        "SELECT id, title FROM chat_sessions WHERE id = ? AND user_id = ?",
        (sid, user_id),
    )
    if not sess:
        raise LookupError("Nie znaleziono rozmowy")
    if sess["title"] == "Nowa rozmowa":
        user_msgs = db.query_one(
            "SELECT COUNT(*) AS c FROM chat_messages WHERE session_id = ? AND role = 'user'",
            (sid,),
        )
        if not user_msgs["c"]:
            title = message if len(message) <= 42 else message[:42] + "…"
            db.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (title, sid))
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in db.query(
            "SELECT role, content FROM chat_messages WHERE session_id = ? "
            "ORDER BY id DESC LIMIT 10",
            (sid,),
        )
    ]
    history.reverse()
    answer = chat_reply(message, history, _chat_context(user_id))
    now = db.now_iso()
    db.execute(
        "INSERT INTO chat_messages (user_id, session_id, role, content, created_at) "
        "VALUES (?, ?, 'user', ?, ?)",
        (user_id, sid, message, now),
    )
    db.execute(
        "INSERT INTO chat_messages (user_id, session_id, role, content, created_at) "
        "VALUES (?, ?, 'assistant', ?, ?)",
        (user_id, sid, answer, now),
    )
    db.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, sid))
    return answer


def _ensure_chat_sessions(user_id):
    """Przenosi stare wiadomości (bez sesji) do istniejącej lub nowej sesji."""
    legacy = db.query(
        "SELECT id FROM chat_messages WHERE user_id = ? AND session_id IS NULL "
        "ORDER BY id",
        (user_id,),
    )
    if not legacy:
        return
    sess = db.query_one(
        "SELECT id FROM chat_sessions WHERE user_id = ? "
        "ORDER BY updated_at DESC LIMIT 1",
        (user_id,),
    )
    if not sess:
        now = db.now_iso()
        db.execute(
            "INSERT INTO chat_sessions (user_id, title, created_at, updated_at) "
            "VALUES (?, 'Rozmowa 1', ?, ?)",
            (user_id, now, now),
        )
        sess = db.query_one(
            "SELECT id FROM chat_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1",
            (user_id,),
        )
    for m in legacy:
        db.execute("UPDATE chat_messages SET session_id = ? WHERE id = ?", (sess["id"], m["id"]))
    db.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (db.now_iso(), sess["id"]))


app = create_app()

if __name__ == "__main__":
    db.init_db()
    import seed as seed_data

    seed_data.seed()
    app.run(host="127.0.0.1", port=5000, debug=True)
