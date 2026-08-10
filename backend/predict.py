# -*- coding: utf-8 -*-
"""
Podpowiedź „jak możesz się dziś czuć” oparta o historię użytkowniczki.

Algorytm uczy się z własnych danych: dla wskazanego dnia sprawdza, w którym
dniu cyklu jesteś (oraz w jakiej fazie) i zagląda, jakie objawy i nastroje
pojawiały się u Ciebie w tym samym momencie cyklu w poprzednich cyklach.
Wynik może zostać opisany przez model AI (jeśli jest skonfigurowany
w groq_key.py / zmiennych środowiskowych), a bez niego — lokalnie.
"""
import json
import urllib.request
from datetime import datetime

import database as db
import cycle as cyc


def _to_date(s):
    return datetime.strptime(s, "%Y-%m-%d").date()


def _parse_list(v):
    if not v:
        return []
    if isinstance(v, list):
        return v
    try:
        out = json.loads(v)
        return out if isinstance(out, list) else []
    except (ValueError, TypeError):
        return []


def _user_method(user):
    if user.get("patch_mode"):
        return {"on": True, "method": "patch", "cycle": 21, "break": 7}
    if user.get("pill_mode"):
        return {
            "on": True,
            "method": "pill",
            "cycle": user["pill_cycle_days"] or 21,
            "break": user["pill_break_days"] if user["pill_break_days"] is not None else 7,
        }
    return {"on": False, "method": None, "cycle": 21, "break": 7}


def _prediction(user, starts):
    method = _user_method(user)
    return cyc.build_calendar(
        starts,
        cycle_length=user["cycle_length_default"],
        period_length=user["period_length_default"],
        pills=method["on"],
        pill_cycle=method["cycle"],
        pill_break=method["break"],
        method=method["method"],
    )


def _phase(day, starts, ends, prediction, period_length, on_pills):
    """Pełna nazwa fazy dla danego dnia (uwzględnia owulację i dni płodne)."""
    day_type = cyc.day_type_for(
        day.isoformat(),
        [s.isoformat() for s in starts],
        [e.isoformat() for e in ends],
        prediction,
    )
    if on_pills:
        return "Przerwa" if day_type == "period" else None
    if day_type == "period":
        return "Okres"
    if day_type == "ovulation":
        return "Owulacja"
    if day_type == "fertile":
        return "Dni płodne"
    cycle = prediction.get("cycle_length") or 28
    period_len = int(period_length or 5)
    last = None
    for s in sorted(starts):
        if s <= day:
            last = s
    if last is None:
        return None
    idx = (day - last).days
    if idx < period_len:
        return "Okres"
    return "Faza folikularna" if idx < cycle - 14 else "Faza lutealna"


def _cycle_day(day, starts):
    """Który to dzień cyklu (1-based) dla danej daty; None, jeśli brak okresów."""
    prev = None
    for s in sorted(starts):
        if s <= day:
            prev = s
        else:
            break
    if prev is None:
        return None
    return (day - prev).days + 1


def predict_feel(user_id, day):
    """Zwraca przewidywane objawy i nastrój na dany dzień (słownik JSON)."""
    user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
    if not user:
        return {"empty": True}
    cycles = db.query(
        "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
    )
    entries = db.query(
        "SELECT * FROM entries WHERE user_id = ? ORDER BY date", (user_id,)
    )
    starts = sorted({cyc.parse_date(c["start_date"]) for c in cycles})
    ends = [cyc.parse_date(c["end_date"]) for c in cycles if c["end_date"]]
    pred = _prediction(user, [s.isoformat() for s in starts])
    method = _user_method(user)
    on_pills = method["on"]
    period_len = user["period_length_default"]

    try:
        target = _to_date(day)
    except (ValueError, TypeError):
        return {"empty": True}

    target_cd = _cycle_day(target, starts)
    target_phase = _phase(
        target, starts, ends, pred, period_len, on_pills
    )
    phase_names = {
        "Okres": "Okres",
        "Faza folikularna": "Faza folikularna",
        "Faza lutealna": "Faza lutealna",
        "Owulacja": "Owulacja",
        "Dni płodne": "Dni płodne",
        "Przerwa": "Przerwa",
    }

    similar = []
    for e in entries:
        ed = e["date"]
        if ed >= day:
            continue
        try:
            e_day = _to_date(ed)
        except (ValueError, TypeError):
            continue
        e_cd = _cycle_day(e_day, starts)
        e_phase = _phase(e_day, starts, ends, pred, period_len, on_pills)
        w = 0.0
        if target_cd and e_cd:
            diff = abs(e_cd - target_cd)
            if diff == 0:
                w = 1.0
            elif diff == 1:
                w = 0.7
            elif diff == 2:
                w = 0.4
            elif e_phase == target_phase:
                w = 0.2
        elif e_phase == target_phase:
            w = 0.5
        if w > 0:
            similar.append((w, e))

    if not similar:
        return {
            "date": day,
            "phase": target_phase,
            "phase_name": phase_names.get(target_phase),
            "cycle_day": target_cd,
            "sample_count": 0,
            "symptoms": [],
            "moods": [],
            "empty": True,
        }

    total = sum(w for w, _ in similar)
    symptom_agg = {}
    mood_agg = {}
    for w, e in similar:
        for s in _parse_list(e.get("symptoms")):
            symptom_agg[s] = symptom_agg.get(s, 0) + w
        for m in _parse_list(e.get("mood")):
            mood_agg[m] = mood_agg.get(m, 0) + w

    symptoms = [
        {"name": n, "pct": round(100 * v / total)}
        for n, v in sorted(symptom_agg.items(), key=lambda x: -x[1])
    ]
    moods = [
        {"name": n, "pct": round(100 * v / total)}
        for n, v in sorted(mood_agg.items(), key=lambda x: -x[1])
    ]
    symptoms = [s for s in symptoms if s["pct"] >= 15][:6]
    moods = [m for m in moods if m["pct"] >= 15][:5]

    result = {
        "date": day,
        "phase": target_phase,
        "phase_name": phase_names.get(target_phase),
        "cycle_day": target_cd,
        "sample_count": len(similar),
        "symptoms": symptoms,
        "moods": moods,
        "empty": False,
    }
    result["text"] = _describe(result)
    return result


def _describe(r):
    """Opis tekstowy — najpierw próbuje modelu AI, potem szablon lokalny."""
    txt = _llm_describe(r)
    if txt:
        return txt
    phase = r.get("phase_name") or "cyklu"
    if r.get("cycle_day"):
        phase_txt = f"w {r['cycle_day']}. dniu cyklu ({phase})"
    else:
        phase_txt = f"w fazie {phase.lower()}"
    if not r["symptoms"] and not r["moods"]:
        return (
            f"W podobnym momencie cyklu ({phase_txt}) nie zapisywałaś jeszcze "
            "żadnych objawów ani nastrojów. Zapisuj je codziennie, a Cyklia "
            "pokaże Ci Twój własny rytm."
        )
    parts = []
    if r["symptoms"]:
        syms = ", ".join(
            f"{s['name']} ({s['pct']}% dni)" for s in r["symptoms"]
        )
        parts.append(f"najczęściej pojawia się: {syms}")
    if r["moods"]:
        mds = ", ".join(m["name"] for m in r["moods"])
        parts.append(f"a z nastrojów dominuje: {mds}")
    base = (
        f"Na podstawie {r['sample_count']} podobnych dni {phase_txt} "
        f"{'; '.join(parts)}. To podpowiedź z Twojej historii — jeśli objawy "
        "są silne albo się powtarzają, wspomnij o nich ginekologowi."
    )
    return base


def _llm_describe(r):
    """Generuje krótki opis przez model AI (jeśli skonfigurowany)."""
    import chat_bot

    api_url, api_key, model = chat_bot._load_groq_config()
    if not (api_url and api_key):
        return None
    phase = r.get("phase_name") or "cykl"
    if r.get("cycle_day"):
        where = f"{r['cycle_day']}. dzień cyklu (faza: {phase})"
    else:
        where = f"faza: {phase}"
    sym = "; ".join(f"{s['name']} w {s['pct']}% podobnych dni" for s in r["symptoms"])
    mds = ", ".join(m["name"] for m in r["moods"]) or "brak"
    user = (
        f"Użytkowniczka jest w {where}. Na podstawie {r['sample_count']} podobnych "
        f"dni z jej historii najczęstsze objawy: {sym or 'brak'}. Nastroje: {mds}.\n"
        "Napisz 2–4 zdania po polsku: jak może się dziś czuć i co może zauważyć. "
        "Ciepło i naturalnie, bez alarmowania, bez list i procentów."
    )
    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Jesteś empatycznym asystentem zdrowia kobiet w aplikacji Cyklia. "
                    "Odpowiadasz po polsku, zwięźle. To treść edukacyjna, nie diagnoza."
                ),
            },
            {"role": "user", "content": user},
        ],
        "temperature": 0.7,
    }
    req = urllib.request.Request(
        api_url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + api_key,
            "User-Agent": "Cyklia/1.0 (podpowiedzi)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return None
