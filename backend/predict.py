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
from collections import Counter
from datetime import datetime, timedelta

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
            "start": user.get("pill_start_date") or None,
        }
    return {"on": False, "method": None, "cycle": 21, "break": 7}


def _first_pill_date(user_id, user):
    """Pierwsza zarejestrowana tabletka bieżącego blistra (kotwica
    harmonogramu); brak logów w ostatnim cyklu → None."""
    active = int(user.get("pill_cycle_days") or 21)
    brk = user.get("pill_break_days")
    total = active + (brk if brk is not None else 7)
    today = datetime.now().strftime("%Y-%m-%d")
    row = db.query_one(
        "SELECT MIN(date) AS d FROM pill_logs WHERE user_id = ? AND date <= ? AND date > ?",
        (user_id, today, (datetime.now() - timedelta(days=total)).strftime("%Y-%m-%d")),
    )
    return row["d"] if row and row["d"] else None


def _prediction(user, starts, user_id=None):
    method = _user_method(user)
    pill_start = method.get("start")
    if user_id and method["on"]:
        pill_start = _first_pill_date(user_id, user) or method.get("start")
    return cyc.build_calendar(
        starts,
        cycle_length=user["cycle_length_default"],
        period_length=user["period_length_default"],
        pills=method["on"],
        pill_cycle=method["cycle"],
        pill_break=method["break"],
        method=method["method"],
        pill_start=pill_start,
    )


def _phase(day, starts, ends, prediction, period_length, on_pills):
    """Pełna nazwa fazy dla danego dnia (uwzględnia owulację i dni płodne)."""
    day_type = cyc.day_type_for(
        day.isoformat(),
        [s.isoformat() for s in starts],
        [e.isoformat() if e is not None else "" for e in ends],
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
    ends = [
        cyc.parse_date(c["end_date"]) if c["end_date"] else None
        for c in sorted(cycles, key=lambda x: x["start_date"])
    ]
    pred = _prediction(user, [s.isoformat() for s in starts], user_id=user_id)
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


def analyze_journal(user_id, days=45):
    """Analiza wpisów z dziennika (objawy, nastrój, sen, stres) — najpierw
    przez model AI, a bez niego lokalne podsumowanie. Zwraca {"ok", "ai", "text"}."""
    user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
    if not user:
        return {"ok": False, "text": "Nie znaleziono użytkownika."}
    cycles = db.query(
        "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
    )
    entries = db.query(
        "SELECT * FROM entries WHERE user_id = ? ORDER BY date", (user_id,)
    )
    if not entries:
        return {
            "ok": False,
            "text": "Najpierw zapisz chociaż jeden wpis w dzienniku — analiza będzie "
            "się opierać na Twoich danych.",
        }
    cutoff = datetime.now().date() - timedelta(days=days)
    filtered = [e for e in entries if _to_date(e["date"]) >= cutoff]
    if not filtered:
        return {
            "ok": False,
            "text": "Brak wpisów z ostatnich 45 dni — zapisuj dziennik codziennie, "
            "żeby analiza miała się na czym oprzeć.",
        }

    starts = sorted({cyc.parse_date(c["start_date"]) for c in cycles})
    ends = [
        cyc.parse_date(c["end_date"]) if c["end_date"] else None
        for c in sorted(cycles, key=lambda x: x["start_date"])
    ]
    pred = _prediction(user, [s.isoformat() for s in starts], user_id=user_id)
    method = _user_method(user)
    on_pills = method["on"]
    period_len = user["period_length_default"]

    sym_count = Counter()
    mood_count = Counter()
    phase_syms = {}
    phase_days = Counter()
    sleeps, stresses, waters, activities, temps = [], [], [], [], []
    n_notes = 0

    for e in filtered:
        d = _to_date(e["date"])
        ph = _phase(d, starts, ends, pred, period_len, on_pills) or "Inne"
        phase_days[ph] += 1
        for s in _parse_list(e["symptoms"]):
            sym_count[s] += 1
            phase_syms.setdefault(ph, Counter())[s] += 1
        for m in _parse_list(e["mood"]):
            mood_count[m] += 1
        if e["sleep"] is not None:
            sleeps.append(float(e["sleep"]))
        if e["stress"] is not None:
            stresses.append(int(e["stress"]))
        if e["water"] is not None:
            waters.append(int(e["water"]))
        if e["activity"] is not None:
            activities.append(int(e["activity"]))
        if e["temperature"] is not None:
            temps.append(float(e["temperature"]))
        if e["notes"]:
            n_notes += 1

    def top(c, n=4):
        return [{"name": k, "count": v} for k, v in c.most_common(n)]

    cycle_lengths = [
        (b - a).days for a, b in zip(starts[:-1], starts[1:]) if (b - a).days > 0
    ]
    period_lengths = [
        (cyc.parse_date(c["end_date"]) - cyc.parse_date(c["start_date"])).days + 1
        for c in cycles
        if c["end_date"]
    ]
    period_lengths = [p for p in period_lengths if 1 <= p <= 21]

    stats = {
        "days_covered": len(filtered),
        "phases": dict(phase_days),
        "phase_symptoms": {
            ph: [{"name": k, "count": v} for k, v in c.most_common(3)]
            for ph, c in phase_syms.items()
        },
        "symptoms": top(sym_count),
        "moods": top(mood_count),
        "sleep_avg": round(sum(sleeps) / len(sleeps), 1) if sleeps else None,
        "stress_avg": round(sum(stresses) / len(stresses), 1) if stresses else None,
        "water_avg": round(sum(waters) / len(waters), 1) if waters else None,
        "activity_avg": round(sum(activities) / len(activities)) if activities else None,
        "temp_avg": round(sum(temps) / len(temps), 2) if temps else None,
        "notes_count": n_notes,
        "cycle_lengths": cycle_lengths,
        "period_lengths": period_lengths,
    }

    text = _llm_analyze(stats)
    if text:
        return {"ok": True, "ai": True, "text": text, "stats": stats}
    return {"ok": True, "ai": False, "text": _local_analyze(stats), "stats": stats}


def _local_analyze(stats):
    parts = [f"Przeanalizowałam {stats['days_covered']} dni Twoich wpisów."]
    if stats["symptoms"]:
        names = ", ".join(
            f"{s['name']} ({s['count']} dni)" for s in stats["symptoms"][:3]
        )
        parts.append(f"Najczęstsze objawy to: {names}.")
    if stats["moods"]:
        parts.append(
            "Wśród nastrojów dominuje: "
            + ", ".join(m["name"] for m in stats["moods"][:3])
            + "."
        )
    if stats["sleep_avg"]:
        parts.append(f"Średnia długość snu to {stats['sleep_avg']} h.")
    if stats["stress_avg"]:
        parts.append(f"Średni poziom stresu to {stats['stress_avg']}/5.")
    parts.append(
        "Zapisuj objawy i nastrój codziennie, a analiza będzie coraz dokładniejsza."
    )
    return " ".join(parts)


def _llm_analyze(stats):
    """Przygotowuje przyjazną analizę dziennika przez model AI (jeśli skonfigurowany)."""
    import chat_bot

    api_url, api_key, model = chat_bot._load_groq_config()
    if not (api_url and api_key):
        return None
    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Jesteś empatycznym asystentem zdrowia kobiet w aplikacji Cyklia. "
                    "Analizujesz dziennik użytkowniczki: objawy, nastrój, sen, stres. "
                    "Odpowiadasz po polsku, ciepło i konkretnie, w 3–6 zdaniach, "
                    "bez list i procentów. To treść edukacyjna, nie diagnoza."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Użytkowniczka zapisała wpisy w dzienniku (ostatnie dni). "
                    "Podsumowanie danych:\n" + json.dumps(stats, ensure_ascii=False)
                    + "\n\nNapisz przyjazną analizę: co zwykle towarzyszy jej cyklowi, "
                    "czy objawy mają związek z fazą cyklu, na co może zwrócić uwagę "
                    "i co może pomóc. Wspomnij o śnie i stresie, jeśli są dane. "
                    "Jeśli danych jest mało, zachęć do codziennego zapisywania."
                ),
            },
        ],
        "temperature": 0.7,
    }
    req = urllib.request.Request(
        api_url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + api_key,
            "User-Agent": "Cyklia/1.0 (analiza dziennika)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return None
