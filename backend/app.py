# -*- coding: utf-8 -*-
import os
from datetime import date, datetime, timedelta

from flask import Flask, jsonify, request
from flask_cors import CORS

import auth
import notify
import localtime
import pillsched
import database as db
import cycle as cyc
import predict
import report
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
        if not user or not auth.verify_password(password, user["password_hash"]):
            return jsonify({"error": "Niepoprawny e-mail lub hasło"}), 401
        if auth.needs_rehash(user["password_hash"]):
            # stary, słaby skrót SHA-256 → bezpieczny PBKDF2 przy logowaniu
            db.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (auth.hash_password(password), user["id"]),
            )
        return jsonify({"token": auth.make_token(user["id"]), "user": _user_payload(user["id"])})

    @app.get("/api/me")
    @auth.auth_required
    def me(user_id):
        return jsonify(_user_payload(user_id))

    @app.post("/api/me/password")
    @auth.auth_required
    def change_password(user_id):
        data = request.get_json(silent=True) or {}
        current = data.get("current_password") or ""
        new_pw = data.get("new_password") or ""
        user = db.query_one("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        if not auth.verify_password(current, user["password_hash"]):
            return jsonify({"error": "Obecne hasło jest niepoprawne"}), 400
        if len(new_pw) < 6:
            return jsonify({"error": "Nowe hasło musi mieć co najmniej 6 znaków"}), 400
        db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (auth.hash_password(new_pw), user_id),
        )
        return jsonify({"ok": True})

    @app.delete("/api/me")
    @auth.auth_required
    def delete_account(user_id):
        data = request.get_json(silent=True) or {}
        user = db.query_one("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        if not auth.verify_password(data.get("password") or "", user["password_hash"]):
            return jsonify({"error": "Niepoprawne hasło"}), 400
        for table in (
            "chat_messages", "chat_sessions", "user_articles", "comments", "posts",
            "entries", "cycles", "pill_logs", "patch_logs", "push_subscriptions",
            "notification_log",
        ):
            db.execute(f"DELETE FROM {table} WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        return jsonify({"ok": True})

    @app.patch("/api/me")
    @auth.auth_required
    def update_me(user_id):
        data = request.get_json(silent=True) or {}
        fields, args = [], []
        if "display_name" in data:
            fields.append("display_name = ?")
            args.append(str(data["display_name"] or "").strip()[:60])
        # Długość cyklu 14–60 dni, długość okresu 1–14 dni (wcześniej oba
        # pola miały zakres 14–60, więc długość okresu nigdy się nie zapisywała).
        for key, lo, hi in (
            ("cycle_length_default", 14, 60),
            ("period_length_default", 1, 14),
        ):
            val = _as_int(data.get(key)) if key in data else None
            if val is not None and lo <= val <= hi:
                fields.append(f"{key} = ?")
                args.append(val)
        for key in NOTIFY_FIELDS:
            if key in data:
                fields.append(f"{key} = ?")
                args.append(1 if data[key] else 0)
        if "notify_period_days" in data:
            val = _as_int(data.get("notify_period_days"))
            if val is not None:
                fields.append("notify_period_days = ?")
                args.append(max(0, min(7, val)))
        if "pill_mode" in data:
            fields.append("pill_mode = ?")
            args.append(1 if data["pill_mode"] else 0)
        if "pill_cycle_days" in data and _as_int(data["pill_cycle_days"]) is not None:
            fields.append("pill_cycle_days = ?")
            args.append(max(1, min(30, _as_int(data["pill_cycle_days"]))))
        if "pill_break_days" in data and _as_int(data["pill_break_days"]) is not None:
            fields.append("pill_break_days = ?")
            args.append(max(0, min(14, _as_int(data["pill_break_days"]))))
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
        if "pill_start_date" in data:
            ps = (data.get("pill_start_date") or "").strip() or None
            if ps is not None:
                try:
                    datetime.strptime(ps, "%Y-%m-%d")
                except ValueError:
                    ps = None
            fields.append("pill_start_date = ?")
            args.append(ps)
        if "patch_mode" in data:
            fields.append("patch_mode = ?")
            args.append(1 if data["patch_mode"] else 0)
            if data["patch_mode"]:
                # wyłączenie trybu tabletek, gdy włączamy plastry
                fields.append("pill_mode = ?")
                args.append(0)
        if "patch_name" in data:
            fields.append("patch_name = ?")
            args.append(str(data.get("patch_name") or ""))
        if "pill_mode" in data and data["pill_mode"]:
            # wyłączenie trybu plastrów, gdy włączamy tabletki
            fields.append("patch_mode = ?")
            args.append(0)
        if fields:
            args.append(user_id)
            db.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", tuple(args))
        return jsonify(_user_payload(user_id))

    # ---------- Antykoncepcja (informacyjna baza tabletek i plastrów) ----------

    @app.get("/api/pills")
    def list_pills():
        import pills as pills_data

        return jsonify(pills_data.PILLS)

    @app.get("/api/patches")
    def list_patches():
        import patches as patches_data

        return jsonify(
            {
                "patches": patches_data.PATCHES,
                "knowledge": patches_data.PATCH_KNOWLEDGE,
                "schedule": patches_data.SCHEDULE,
            }
        )

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
        day = request.args.get("date") or localtime.today_iso()
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        return jsonify(_pill_status(user_id, day))

    @app.post("/api/pills/log")
    @auth.auth_required
    def mark_pill_taken(user_id):
        data = request.get_json(silent=True) or {}
        day = data.get("date") or localtime.today_iso()
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        taken_at = (data.get("time") or localtime.now_hm()).strip()
        try:
            datetime.strptime(taken_at, "%H:%M")
        except ValueError:
            return jsonify({"error": "Podaj godzinę w formacie HH:MM"}), 400
        if day > localtime.today_iso():
            return jsonify({"error": "Nie można zaznaczyć tabletki w przyszłości."}), 400
        status = _pill_status(user_id, day)
        if not status["on_pills"]:
            return jsonify({"error": "Włącz tryb tabletek w profilu (Antykoncepcja)."}), 400
        # Tabletka w dniu przerwy jest dozwolona: oznacza rozpoczęcie nowego
        # blistra wcześniej — harmonogram i prognoza okresu przesuwają się.
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
        day = data.get("date") or localtime.today_iso()
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        db.execute(
            "DELETE FROM pill_logs WHERE user_id = ? AND date = ?", (user_id, day)
        )
        return jsonify(_pill_status(user_id, day))

    # ---------- Plastry — dzienny log (czy naklejony) ----------

    @app.get("/api/patch/log/dates")
    @auth.auth_required
    def list_patch_log_dates(user_id):
        rows = db.query(
            "SELECT date FROM patch_logs WHERE user_id = ? ORDER BY date", (user_id,)
        )
        return jsonify({"dates": [r["date"] for r in rows]})

    @app.get("/api/patch/log")
    @auth.auth_required
    def get_patch_log(user_id):
        day = request.args.get("date") or localtime.today_iso()
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        return jsonify(_patch_status(user_id, day))

    @app.post("/api/patch/log")
    @auth.auth_required
    def mark_patch_applied(user_id):
        data = request.get_json(silent=True) or {}
        day = data.get("date") or localtime.today_iso()
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        status = _patch_status(user_id, day)
        if not status.get("needs_change"):
            return jsonify({"error": "Dziś nie musisz zmieniać plastra."}), 400
        db.execute(
            "INSERT INTO patch_logs (user_id, date, applied_at, created_at) "
            "VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id, date) DO UPDATE SET applied_at = excluded.applied_at",
            (user_id, day, localtime.now_hm(), db.now_iso()),
        )
        return jsonify(_patch_status(user_id, day))

    @app.delete("/api/patch/log")
    @auth.auth_required
    def unmark_patch(user_id):
        data = request.get_json(silent=True) or {}
        day = data.get("date") or localtime.today_iso()
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        db.execute(
            "DELETE FROM patch_logs WHERE user_id = ? AND date = ?", (user_id, day)
        )
        return jsonify(_patch_status(user_id, day))

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
        if start > localtime.today_iso():
            return jsonify({"error": "Okres nie może zaczynać się w przyszłości"}), 400
        if end:
            try:
                datetime.strptime(end, "%Y-%m-%d")
            except ValueError:
                return jsonify({"error": "Nieprawidłowa data zakończenia"}), 400
            if end < start:
                return jsonify({"error": "Koniec okresu nie może być przed początkiem"}), 400
        existing = db.query_one(
            "SELECT * FROM cycles WHERE user_id = ? AND start_date = ?", (user_id, start)
        )
        if existing:
            if end and (not existing["end_date"] or existing["end_date"] < end):
                db.execute(
                    "UPDATE cycles SET end_date = ? WHERE id = ?",
                    (end, existing["id"]),
                )
                existing = db.query_one(
                    "SELECT * FROM cycles WHERE id = ?", (existing["id"],)
                )
            return jsonify(existing), 200
        cid = db.execute(
            "INSERT INTO cycles (user_id, start_date, end_date, flow_level) "
            "VALUES (?, ?, ?, ?)",
            (user_id, start, end, _as_int(flow) or 1),
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
            args.append(_as_int(data["flow_level"]) or 1)
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

    # ---------- Podpowiedź „jak możesz się dziś czuć” (uczy się z historii) ----------

    @app.get("/api/predict/<day>")
    @auth.auth_required
    def predict_day(user_id, day):
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Nieprawidłowa data"}), 400
        return jsonify(predict.predict_feel(user_id, day))

    @app.get("/api/journal/ai")
    @auth.auth_required
    def journal_ai(user_id):
        return jsonify(predict.analyze_journal(user_id))

    # ---------- Raport PDF dla ginekologa ----------

    @app.get("/api/report/pdf")
    @auth.auth_required
    def report_pdf(user_id):
        from flask import send_file
        import io as _io

        try:
            data = report.build_report(user_id)
            pdf_bytes = report.render_pdf(data)
        except RuntimeError as e:
            return jsonify({"error": str(e)}), 500
        return send_file(
            _io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name="raport-ginekolog.pdf",
        )

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
            "bleeding": _to_json_list(data.get("bleeding")) if data.get("bleeding") is not None else None,
            "digestive": _to_json_list(data.get("digestive")) if data.get("digestive") is not None else None,
        }
        if existing:
            db.execute(
                "UPDATE entries SET temperature=?, mood=?, symptoms=?, notes=?, "
                "water=?, sleep=?, activity=?, libido=?, stress=?, mucus=?, weight=?, "
                "steps=?, sleep_quality=?, sex=?, bleeding=?, digestive=? "
                "WHERE id=?",
                (
                    vals["temperature"], vals["mood"], vals["symptoms"], vals["notes"],
                    vals["water"], vals["sleep"], vals["activity"], vals["libido"],
                    vals["stress"], vals["mucus"], vals["weight"], vals["steps"],
                    vals["sleep_quality"], vals["sex"], vals["bleeding"], vals["digestive"],
                    existing["id"],
                ),
            )
        else:
            db.execute(
                "INSERT INTO entries (user_id, date, temperature, mood, symptoms, notes, "
                "water, sleep, activity, libido, stress, mucus, weight, steps, sleep_quality, sex, "
                "bleeding, digestive) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    user_id, day, vals["temperature"], vals["mood"], vals["symptoms"],
                    vals["notes"], vals["water"], vals["sleep"], vals["activity"],
                    vals["libido"], vals["stress"], vals["mucus"], vals["weight"],
                    vals["steps"], vals["sleep_quality"], vals["sex"],
                    vals["bleeding"], vals["digestive"],
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
        ends = [c["end_date"] or None for c in cycles]
        method = _user_method(user)
        pred = cyc.build_calendar(
            starts,
            cycle_length=user["cycle_length_default"],
            period_length=user["period_length_default"],
            pills=method["on"],
            pill_cycle=method["cycle"],
            pill_break=method["break"],
            method=method["method"],
            pill_start=_pill_anchor(user_id, user),
        )
        # zakres widoczny: od pierwszego wpisu do +90 dni w przyszłość
        min_day = min(starts) if starts else localtime.today_iso()
        max_day = (localtime.today() + __import__("datetime").timedelta(days=90)).isoformat()
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
        method = _user_method(user)
        pred = cyc.build_calendar(
            starts,
            cycle_length=user["cycle_length_default"],
            period_length=user["period_length_default"],
            pills=method["on"],
            pill_cycle=method["cycle"],
            pill_break=method["break"],
            method=method["method"],
            pill_start=_pill_anchor(user_id, user),
        )
        phase_order = (
            ["Przerwa"]
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
        today = localtime.today_iso()
        cycles = db.query(
            "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
        )
        user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
        starts = [c["start_date"] for c in cycles]
        method = _user_method(user)
        pred = cyc.build_calendar(
            starts,
            cycle_length=user["cycle_length_default"],
            period_length=user["period_length_default"],
            pills=method["on"],
            pill_cycle=method["cycle"],
            pill_break=method["break"],
            method=method["method"],
            pill_start=_pill_anchor(user_id, user),
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

    # ---------- Powiadomienia push ----------

    @app.get("/api/push/public-key")
    def push_public_key():
        key = notify.public_key()
        return jsonify({"key": key, "available": bool(key)})

    @app.get("/api/push/status")
    @auth.auth_required
    def push_status(user_id):
        return jsonify({
            "available": notify.PUSH_AVAILABLE,
            "devices": notify.subscription_count(user_id),
        })

    @app.post("/api/push/subscribe")
    @auth.auth_required
    def push_subscribe(user_id):
        data = request.get_json(silent=True) or {}
        try:
            notify.save_subscription(user_id, data.get("subscription") or data)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        return jsonify({"ok": True, "devices": notify.subscription_count(user_id)})

    @app.post("/api/push/unsubscribe")
    @auth.auth_required
    def push_unsubscribe(user_id):
        data = request.get_json(silent=True) or {}
        endpoint = data.get("endpoint")
        if endpoint:
            notify.delete_subscription(user_id, endpoint)
        return jsonify({"ok": True, "devices": notify.subscription_count(user_id)})

    @app.post("/api/push/test")
    @auth.auth_required
    def push_test(user_id):
        sent, errors = notify.send_to_user(
            user_id,
            "Cyklia 🌸",
            "Powiadomienia działają! Tak będą wyglądać przypomnienia.",
            "/profil",
            tag="test",
        )
        if not sent:
            return jsonify({"error": errors[0] if errors else "Nie wysłano", "errors": errors}), 502
        return jsonify({"sent": sent, "errors": errors})

    @app.route("/api/cron/reminders", methods=["GET", "POST"])
    def cron_reminders():
        import hmac as _hmac

        key = request.args.get("key") or request.headers.get("X-Cron-Key") or ""
        if not _hmac.compare_digest(key, notify.cron_key()):
            return jsonify({"error": "Brak dostępu"}), 403
        return jsonify(notify.run_reminders())

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


NOTIFY_FIELDS = ("notify_pill", "notify_period", "notify_fertile", "notify_patch")


def _as_int(value):
    """Bezpieczna konwersja na int (liczba lub tekst z liczbą), inaczej None."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value.strip())
    return None


def _user_payload(user_id):
    u = db.query_one(
        "SELECT id, email, display_name, cycle_length_default, period_length_default, "
        "pill_mode, pill_cycle_days, pill_break_days, pill_name, pill_time, "
        "pill_start_date, patch_mode, patch_name, notify_pill, notify_period, "
        "notify_fertile, notify_patch, notify_period_days, created_at "
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


def _pill_anchor(user_id, user):
    """Kotwica harmonogramu tabletek — patrz pillsched.pill_anchor."""
    return pillsched.pill_anchor(user_id, user)


def _pill_status(user_id, day):
    """Status tabletki na dany dzień: czy trzeba przyjąć, czy już wzięta, czy spóźniona."""
    user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
    cycles = db.query(
        "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
    )
    starts = [c["start_date"] for c in cycles]
    ends = [c["end_date"] or None for c in cycles]
    on_pills = bool(user["pill_mode"])
    anchor = _pill_anchor(user_id, user) if on_pills else None
    pred = cyc.build_calendar(
        starts,
        cycle_length=user["cycle_length_default"],
        period_length=user["period_length_default"],
        pills=on_pills,
        pill_cycle=user["pill_cycle_days"] or 21,
        pill_break=_pill_break_value(user),
        pill_start=anchor,
    )
    day_type = cyc.day_type_for(day, starts, ends, pred) if on_pills else "normal"
    needs_log = on_pills and cyc.pill_active(
        day,
        anchor,
        user["pill_cycle_days"] or 21,
        _pill_break_value(user),
    )
    pack_day = None
    if anchor:
        active_n = user["pill_cycle_days"] or 21
        brk_n = _pill_break_value(user)
        total_n = active_n + brk_n
        if brk_n > 0:
            pos = (cyc.parse_date(day) - cyc.parse_date(anchor)).days % total_n
            if pos < active_n:
                pack_day = pos + 1
            else:
                pack_day = -(pos - active_n + 1)
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
    brk_n = _pill_break_value(user)
    active_n = user["pill_cycle_days"] or 21
    return {
        "date": day,
        "on_pills": on_pills,
        "pill_name": user.get("pill_name") or "",
        "active_days": active_n,
        "break_days": brk_n,
        "in_break": bool(on_pills and pack_day is not None and pack_day < 0),
        "next_pack_start": pred.get("next_pack_start"),
        "last_pill_date": pred.get("last_pill_date"),
        "next_period_start": pred.get("next_period_start"),
        "day_type": day_type,
        "needs_log": needs_log,
        "pack_day": pack_day,
        "taken": bool(log),
        "taken_at": taken_at,
        "expected_time": expected,
        "threshold_hours": threshold_h,
        "late": late,
        "warning": warning,
    }


def _user_method(user):
    """Jaka antykoncepcja hormonalna jest aktywna u użytkowniczki."""
    if user.get("patch_mode"):
        return {
            "on": True,
            "method": "patch",
            "cycle": 21,
            "break": 7,
            "break_days": 7,
        }
    if user.get("pill_mode"):
        return {
            "on": True,
            "method": "pill",
            "cycle": user["pill_cycle_days"] or 21,
            "break": (user["pill_break_days"] if user["pill_break_days"] is not None else 7),
            "break_days": (user["pill_break_days"] if user["pill_break_days"] is not None else 7),
            "start": user.get("pill_start_date") or None,
        }
    return {"on": False, "method": None, "cycle": 21, "break": 7, "break_days": 7}


def _patch_status(user_id, day):
    """Status plastra na dany dzień według 28-dniowego schematu 21+7.

    Dzień 1 cyklu (start okresu) = naklejenie plastra nr 1.
    Zmiana plastra: dzień 1, 8, 15. Przerwa: dni 22–28.
    """
    user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
    cycles = db.query(
        "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
    )
    starts = [c["start_date"] for c in cycles]
    on_patch = bool(user["patch_mode"])
    result = {"date": day, "on_patch": on_patch, "phase": None}
    if not on_patch:
        result.update(
            {
                "needs_change": False,
                "applied": False,
                "applied_at": None,
                "patch_number": None,
                "days_to_change": None,
                "message": None,
            }
        )
        return result
    today = cyc.parse_date(day)
    past = [cyc.parse_date(s) for s in starts if cyc.parse_date(s) <= today]
    if not past:
        result.update(
            {
                "needs_change": False,
                "applied": False,
                "applied_at": None,
                "patch_number": None,
                "days_to_change": None,
                "message": "Zaznacz początek okresu, żeby śledzić plastry.",
            }
        )
        return result
    cycle_start = past[-1]
    cycle_day = (today - cycle_start).days + 1
    cd = ((cycle_day - 1) % 28) + 1
    log = db.query_one(
        "SELECT * FROM patch_logs WHERE user_id = ? AND date = ?", (user_id, day)
    )
    applied_at = log["applied_at"] if log else None
    if cd == 1:
        phase, needs, number = "change", True, 1
        message = "Naklej nowy plaster dziś"
    elif cd == 8:
        phase, needs, number = "change", True, 2
        message = "Zmień plaster — naklej nowy dziś (2. tydzień)"
    elif cd == 15:
        phase, needs, number = "change", True, 3
        message = "Zmień plaster — naklej nowy dziś (3. tydzień)"
    elif cd == 22:
        phase, needs, number = "remove", True, 0
        message = "Zdejmij plaster — dziś zaczyna się przerwa"
    elif 23 <= cd <= 28:
        phase, needs, number = "break", False, 0
        message = "Przerwa — bez plastra"
    elif 2 <= cd <= 7:
        phase, needs, number = "worn", False, 1
        message = f"Plaster nr 1 założony · zmiana za {8 - cd} dni"
    elif 9 <= cd <= 14:
        phase, needs, number = "worn", False, 2
        message = f"Plaster nr 2 założony · zmiana za {15 - cd} dni"
    else:
        phase, needs, number = "worn", False, 3
        message = f"Plaster nr 3 założony · zmiana za {22 - cd} dni"
    result.update(
        {
            "needs_change": needs,
            "applied": bool(log),
            "applied_at": applied_at,
            "patch_number": number,
            "phase": phase,
            "confirm_label": "Zdjęłam" if phase == "remove" else "Nakleiłam",
            "days_to_change": None,
            "message": message,
            "cycle_day": cycle_day,
            "cycle_start": cycle_start.isoformat(),
        }
    )
    if applied_at:
        if phase == "remove":
            result["message"] = f"Odnotowano (zdjęcie plastra) o {applied_at}"
        else:
            result["message"] = f"Naklejony o {applied_at}"
    return result


def _chat_context(user_id):
    """Buduje kontekst z kalendarza użytkownika, by asystent mógł podać konkretne daty."""
    from datetime import timedelta

    cycles = db.query(
        "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
    )
    user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
    starts = [c["start_date"] for c in cycles]
    method = _user_method(user)
    pred = cyc.build_calendar(
        starts,
        cycle_length=user["cycle_length_default"],
        period_length=user["period_length_default"],
        pills=method["on"],
        pill_cycle=method["cycle"],
        pill_break=method["break"],
        method=method["method"],
        pill_start=_pill_anchor(user_id, user),
    )
    today = localtime.today()
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
        ends = [c["end_date"] or None for c in cycles]
        today_type = cyc.day_type_for(today.isoformat(), starts, ends, pred)

    on_pills = bool(user["pill_mode"])
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

    patch_name = user["patch_name"] or ""
    patch_status = None
    if user.get("patch_mode"):
        try:
            patch_status = _patch_status(user_id, today.isoformat())
        except Exception:
            patch_status = None

    return {
        "method": method["method"],
        "on_pills": on_pills,
        "pill_name": pill_name,
        "pill_type": pill_type,
        "pill_cycle_days": user["pill_cycle_days"] or 21,
        "pill_break_days": (user["pill_break_days"] if user["pill_break_days"] is not None else 7),
        "pill_time": user["pill_time"] or "12:00",
        "patch_name": patch_name,
        "patch_status": patch_status,
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
        return "Przerwa" if day_type == "period" else None
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
