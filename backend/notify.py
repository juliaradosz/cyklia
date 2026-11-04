# -*- coding: utf-8 -*-
"""Powiadomienia push (Web Push / VAPID): tabletka, plaster, okres, dni płodne.

Jak to działa:
1. Telefon/przeglądarka zapisuje subskrypcję push (/api/push/subscribe).
2. Co kilka-kilkanaście minut ktoś wywołuje ``run_reminders()`` — albo
   zewnętrzny cron (np. cron-job.org) przez adres
   ``/api/cron/reminders?key=...``, albo zadanie zaplanowane PythonAnywhere
   (``python send_reminders.py``).
3. Dla każdej użytkowniczki liczymy, co jest „na dziś” i wysyłamy każde
   przypomnienie najwyżej raz dziennie (tabela notification_log).
"""
import hashlib
import json
import os
from datetime import datetime, timedelta

import database as db
import localtime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VAPID_FILE = os.environ.get("CYKLIA_VAPID_FILE", os.path.join(BASE_DIR, "vapid_private.pem"))
CRON_KEY_FILE = os.path.join(BASE_DIR, "cron.key")
VAPID_SUB = os.environ.get("CYKLIA_VAPID_SUB", "mailto:cyklia@example.com")

# Przypomnienia o okresie / dniach płodnych / plastrze — nie wcześniej niż
# o 9:00 i nie później niż o 21:59 (żeby nie budzić w nocy).
DAY_START_H = 9
DAY_END_H = 22
# Drugie przypomnienie o tabletce, gdy po tylu minutach wciąż nie zaznaczona.
PILL_LATE_MIN = 120

try:
    from pywebpush import WebPushException, webpush
    from py_vapid import Vapid

    PUSH_AVAILABLE = True
except Exception:  # biblioteka niezainstalowana
    PUSH_AVAILABLE = False


# ---------- Klucze ----------

def _vapid():
    if not PUSH_AVAILABLE:
        return None
    if os.path.isfile(VAPID_FILE):
        return Vapid.from_file(VAPID_FILE)
    v = Vapid()
    v.generate_keys()
    v.save_key(VAPID_FILE)
    return v


def public_key():
    """Klucz publiczny VAPID (base64url) dla PushManager.subscribe()."""
    import base64

    from cryptography.hazmat.primitives import serialization

    v = _vapid()
    if v is None:
        return None
    raw = v.public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def cron_key():
    """Sekret chroniący adres crona (zmienna CYKLIA_CRON_KEY albo plik cron.key)."""
    env = os.environ.get("CYKLIA_CRON_KEY")
    if env:
        return env.strip()
    try:
        with open(CRON_KEY_FILE, "r") as f:
            key = f.read().strip()
            if key:
                return key
    except OSError:
        pass
    key = hashlib.sha256(os.urandom(32)).hexdigest()[:32]
    try:
        with open(CRON_KEY_FILE, "w") as f:
            f.write(key)
    except OSError:
        pass
    return key


# ---------- Subskrypcje ----------

def save_subscription(user_id, sub):
    endpoint = (sub or {}).get("endpoint")
    keys = (sub or {}).get("keys") or {}
    if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
        raise ValueError("Niepełna subskrypcja push")
    db.execute(
        "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) "
        "VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, "
        "p256dh = excluded.p256dh, auth = excluded.auth",
        (user_id, endpoint, keys["p256dh"], keys["auth"], db.now_iso()),
    )


def delete_subscription(user_id, endpoint):
    db.execute(
        "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
        (user_id, endpoint),
    )


def subscription_count(user_id):
    row = db.query_one(
        "SELECT COUNT(*) AS c FROM push_subscriptions WHERE user_id = ?", (user_id,)
    )
    return row["c"] if row else 0


# ---------- Wysyłka ----------

def send_to_user(user_id, title, body, url="/", tag=None):
    """Wysyła powiadomienie na wszystkie urządzenia użytkowniczki.
    Zwraca (liczba_wysłanych, lista_błędów)."""
    if not PUSH_AVAILABLE:
        return 0, ["Brak biblioteki pywebpush na serwerze (pip install -r requirements.txt)"]
    subs = db.query("SELECT * FROM push_subscriptions WHERE user_id = ?", (user_id,))
    if not subs:
        return 0, ["Brak zapisanych urządzeń — włącz powiadomienia w aplikacji"]
    payload = json.dumps(
        {"title": title, "body": body, "url": url, "tag": tag or title},
        ensure_ascii=False,
    )
    sent, errors = 0, []
    _vapid()  # upewnij się, że plik klucza istnieje
    for s in subs:
        info = {"endpoint": s["endpoint"], "keys": {"p256dh": s["p256dh"], "auth": s["auth"]}}
        try:
            webpush(
                subscription_info=info,
                data=payload,
                vapid_private_key=VAPID_FILE,
                vapid_claims={"sub": VAPID_SUB},
                ttl=60 * 60 * 6,
                timeout=10,
            )
            sent += 1
        except WebPushException as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (404, 410):
                # subskrypcja wygasła / urządzenie wyrejestrowane
                db.execute("DELETE FROM push_subscriptions WHERE id = ?", (s["id"],))
            else:
                errors.append(f"Błąd wysyłki ({status or 'brak odpowiedzi'}): {str(e)[:160]}")
        except Exception as e:  # np. brak dostępu do sieci na serwerze
            errors.append(f"Błąd wysyłki: {str(e)[:160]}")
    return sent, errors


# ---------- Co przypomnieć dziś ----------

def _minutes(hm):
    try:
        h, m = (int(x) for x in str(hm).split(":"))
        return h * 60 + m
    except (ValueError, AttributeError):
        return 12 * 60


def _days_word(n):
    return "dzień" if n == 1 else "dni"


def due_reminders(user, now=None):
    """Lista przypomnień należnych teraz: [(kind, title, body, url)]."""
    import app as appmod  # import leniwy — unikamy cyklicznego importu

    now = now or localtime.now()
    today = now.date().isoformat()
    minutes_now = now.hour * 60 + now.minute
    daytime = DAY_START_H <= now.hour < DAY_END_H
    uid = user["id"]
    out = []

    # Tabletka
    if user.get("pill_mode") and user.get("notify_pill", 1):
        st = appmod._pill_status(uid, today)
        if st["needs_log"] and not st["taken"]:
            expected = _minutes(st["expected_time"])
            name = user.get("pill_name") or "tabletkę"
            if minutes_now >= expected:
                out.append((
                    "pill",
                    "Czas na tabletkę 💊",
                    f"Weź {name} i zaznacz to w Cyklii.",
                    "/",
                ))
            if minutes_now >= expected + PILL_LATE_MIN:
                out.append((
                    "pill_late",
                    "Tabletka nie jest jeszcze zaznaczona",
                    f"Minęły 2 godz. od zwykłej pory ({st['expected_time']}). "
                    "Jeśli już ją wzięłaś — zaznacz w aplikacji.",
                    "/",
                ))

    # Plaster
    if user.get("patch_mode") and user.get("notify_patch", 1) and daytime:
        st = appmod._patch_status(uid, today)
        if st.get("needs_change") and not st.get("applied"):
            title = "Zdejmij plaster" if st.get("phase") == "remove" else "Zmień plaster"
            out.append(("patch", title, st.get("message") or title, "/"))

    # Okres i dni płodne
    if daytime and (user.get("notify_period", 1) or user.get("notify_fertile", 0)):
        ctx = appmod._chat_context(uid)
        dtp = ctx.get("days_to_period")
        lead = user.get("notify_period_days")
        lead = 2 if lead is None else int(lead)
        if user.get("notify_period", 1) and dtp is not None and ctx.get("today_type") != "period":
            if lead > 0 and dtp == lead:
                out.append((
                    "period_soon",
                    f"Okres za {dtp} {_days_word(dtp)} 🌸",
                    f"Prognoza: {_pl_date(ctx['next_period_start'])}. "
                    "Warto mieć przy sobie podpaski lub tampony.",
                    "/kalendarz",
                ))
            if dtp == 0:
                out.append((
                    "period_today",
                    "Okres może zacząć się dziś 🌸",
                    "Gdy się zacznie, zaznacz go w kalendarzu — prognozy będą dokładniejsze.",
                    "/kalendarz",
                ))
        if (
            user.get("notify_fertile", 0)
            and not ctx.get("on_pills")
            and ctx.get("method") is None
            and ctx.get("fertile_start") == today
        ):
            out.append((
                "fertile",
                "Zaczynają się dni płodne",
                f"Przewidywana owulacja: {_pl_date(ctx.get('ovulation_date'))}.",
                "/kalendarz",
            ))
    return out


MONTHS = [
    "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca",
    "sierpnia", "września", "października", "listopada", "grudnia",
]


def _pl_date(iso):
    try:
        d = datetime.strptime(iso, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return iso or "—"
    return f"{d.day} {MONTHS[d.month - 1]}"


def run_reminders(now=None):
    """Wysyła wszystkie należne przypomnienia. Zwraca podsumowanie."""
    now = now or localtime.now()
    today = now.date().isoformat()
    summary = {"time": now.strftime("%Y-%m-%d %H:%M"), "users": 0, "sent": 0, "errors": []}
    if not PUSH_AVAILABLE:
        summary["errors"].append("Brak biblioteki pywebpush")
        return summary
    users = db.query(
        "SELECT u.* FROM users u WHERE EXISTS "
        "(SELECT 1 FROM push_subscriptions s WHERE s.user_id = u.id)"
    )
    for user in users:
        summary["users"] += 1
        try:
            due = due_reminders(user, now)
        except Exception as e:
            summary["errors"].append(f"user {user['id']}: {str(e)[:120]}")
            continue
        for kind, title, body, url in due:
            if db.query_one(
                "SELECT 1 AS x FROM notification_log WHERE user_id = ? AND kind = ? AND day = ?",
                (user["id"], kind, today),
            ):
                continue
            sent, errors = send_to_user(user["id"], title, body, url, tag=kind)
            summary["sent"] += sent
            summary["errors"].extend(errors)
            if sent:
                db.execute(
                    "INSERT OR IGNORE INTO notification_log (user_id, kind, day, sent_at) "
                    "VALUES (?, ?, ?, ?)",
                    (user["id"], kind, today, db.now_iso()),
                )
    # sprzątanie starego logu
    db.execute(
        "DELETE FROM notification_log WHERE day < ?",
        ((now.date() - timedelta(days=60)).isoformat(),),
    )
    return summary
