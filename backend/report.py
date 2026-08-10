# -*- coding: utf-8 -*-
"""
Raport PDF dla ginekologa.

Zbiera historię cykli, okresów, objawów, nastrojów i pomiarów użytkowniczki
i renderuje czytelny dokument PDF (czcionka DejaVu → pełne polskie znaki).
Sekcję podsumowania przygotowuje model AI (jeśli skonfigurowany), a bez niego
lokalne podsumowanie regułowe.
"""
import io
import json
import os
import urllib.request
from datetime import datetime

import database as db
import predict as pred

FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")


def _parse_list(v):
    return pred._parse_list(v)


def _build_stats(user_id):
    user = db.query_one("SELECT * FROM users WHERE id = ?", (user_id,))
    cycles = db.query(
        "SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date", (user_id,)
    )
    entries = db.query(
        "SELECT * FROM entries WHERE user_id = ? ORDER BY date", (user_id,)
    )
    starts = sorted({pred._to_date(c["start_date"]) for c in cycles})
    ends = [
        pred._to_date(c["end_date"]) if c["end_date"] else None
        for c in sorted(cycles, key=lambda x: x["start_date"])
    ]
    pred_obj = pred._prediction(user, [s.isoformat() for s in starts])
    on_pills = bool(pred._user_method(user)["on"])
    period_len = user["period_length_default"]

    cycle_lengths = [
        (b - a).days
        for a, b in zip(starts[:-1], starts[1:])
        if (b - a).days > 0
    ]
    period_lengths = [
        (c["end_date"] and (pred._to_date(c["end_date"]) - pred._to_date(c["start_date"])).days + 1)
        for c in cycles
        if c["end_date"]
    ]
    period_lengths = [p for p in period_lengths if p and 1 <= p <= 21]

    def avg(xs):
        return round(sum(xs) / len(xs), 1) if xs else None

    recent = []
    for i, c in enumerate(cycles[-6:]):
        s = pred._to_date(c["start_date"])
        nxt = starts[starts.index(s) + 1] if s in starts and starts.index(s) + 1 < len(starts) else None
        recent.append(
            {
                "start": c["start_date"],
                "end": c["end_date"] or "",
                "cycle_len": (nxt - s).days if nxt else None,
                "period_len": (
                    (pred._to_date(c["end_date"]) - s).days + 1 if c["end_date"] else None
                ),
            }
        )

    symptom_counts = {}
    mood_counts = {}
    sleep_vals = []
    activity_vals = []
    steps_vals = []
    temps = []
    symptoms_by_phase = {}
    for e in entries:
        for s in _parse_list(e.get("symptoms")):
            symptom_counts[s] = symptom_counts.get(s, 0) + 1
        for m in _parse_list(e.get("mood")):
            mood_counts[m] = mood_counts.get(m, 0) + 1
        if e["sleep"] is not None:
            sleep_vals.append(e["sleep"])
        if e["activity"] is not None:
            activity_vals.append(e["activity"])
        if e["steps"]:
            steps_vals.append(e["steps"])
        if e["temperature"]:
            temps.append([e["date"], e["temperature"]])
        ph = pred._phase(
            pred._to_date(e["date"]), starts, ends, pred_obj, period_len, on_pills
        )
        if ph:
            for s in _parse_list(e.get("symptoms")):
                symptoms_by_phase.setdefault(ph, {})
                symptoms_by_phase[ph][s] = symptoms_by_phase[ph].get(s, 0) + 1

    phase_symptoms = []
    for ph, m in sorted(symptoms_by_phase.items(), key=lambda kv: -sum(kv[1].values())):
        top = sorted(m.items(), key=lambda x: -x[1])[:4]
        phase_symptoms.append(
            {"phase": ph, "symptoms": [{"name": n, "count": c} for n, c in top]}
        )

    return {
        "user": user,
        "cycle_count": len(starts),
        "average_cycle": avg(cycle_lengths),
        "min_cycle": min(cycle_lengths) if cycle_lengths else None,
        "max_cycle": max(cycle_lengths) if cycle_lengths else None,
        "average_period": avg(period_lengths),
        "min_period": min(period_lengths) if period_lengths else None,
        "max_period": max(period_lengths) if period_lengths else None,
        "last_period_start": starts[-1].isoformat() if starts else None,
        "next_period_start": pred_obj.get("next_period_start"),
        "cycle_length": pred_obj.get("cycle_length"),
        "on_pills": on_pills,
        "recent_cycles": recent,
        "top_symptoms": [
            {"name": n, "count": c}
            for n, c in sorted(symptom_counts.items(), key=lambda x: -x[1])[:8]
        ],
        "top_moods": [
            {"name": n, "count": c}
            for n, c in sorted(mood_counts.items(), key=lambda x: -x[1])[:6]
        ],
        "phase_symptoms": phase_symptoms,
        "average_sleep": avg(sleep_vals),
        "average_activity": avg(activity_vals),
        "total_steps": sum(steps_vals),
        "average_temp": avg([t for _, t in temps]),
        "last_temp": temps[-1][1] if temps else None,
        "entry_count": len(entries),
    }


def _local_summary(d):
    parts = []
    n = d["cycle_count"]
    if n >= 2 and d["min_cycle"] and d["max_cycle"]:
        spread = d["max_cycle"] - d["min_cycle"]
        reg = (
            "regularne"
            if spread <= 7
            else f"nieregularne (różnica długości do {spread} dni)"
        )
        parts.append(
            f"Zarejestrowano {n} cykle; średnia długość {d['average_cycle']} dni "
            f"(zakres {d['min_cycle']}–{d['max_cycle']}), co wskazuje na cykle {reg}."
        )
    elif n == 1:
        parts.append(
            "Zarejestrowano 1 cykl — danych za mało, by ocenić regularność."
        )
    else:
        parts.append("Brak zarejestrowanych cykli w aplikacji.")
    if d["average_period"]:
        parts.append(
            f"Średnia długość okresu {d['average_period']} dni"
            + (
                f" (zakres {d['min_period']}–{d['max_period']})"
                if d["min_period"] != d["max_period"]
                else ""
            )
            + "."
        )
    if d["top_symptoms"]:
        syms = ", ".join(
            f"{s['name']} ({s['count']}×)" for s in d["top_symptoms"][:5]
        )
        parts.append(f"Najczęściej notowane objawy: {syms}.")
    if d["top_moods"]:
        mds = ", ".join(m["name"] for m in d["top_moods"][:4])
        parts.append(f"Dominujące nastroje: {mds}.")
    if d["average_sleep"]:
        parts.append(f"Średnia długość snu: {d['average_sleep']} h.")
    parts.append(
        "Raport wygenerowany przez użytkowniczkę w aplikacji Cyklia — "
        "interpretacja należy do lekarza prowadzącego."
    )
    return " ".join(parts)


def _ai_summary(d):
    """Podsumowanie dla ginekologa generowane modelem AI (z lokalnym zapasem)."""
    import chat_bot

    api_url, api_key, model = chat_bot._load_groq_config()
    facts = _local_summary(d)
    if not (api_url and api_key):
        return facts
    user = (
        "Użytkowniczka aplikacji Cyklia udaje się do ginekologa. Oto fakty z jej "
        f"historii:\n{facts}\n\n"
        "Napisz 3–6 zdań po polsku, profesjonalnie i rzeczowo: podsumowanie dla "
        "ginekologa. Zaznacz to, co warto omówić (regularność, najczęstsze objawy "
        "i ich faza, sen, ewentualne niepokojące wzorce). Zakończ informacją, że "
        "raport powstał w aplikacji i nie jest diagnozą."
    )
    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Jesteś asystentem wspierającym przygotowanie wizyty u ginekologa. "
                    "Piszesz po polsku, rzeczowo i bez alarmowania, na podstawie "
                    "dostarczonych danych. Nie dodajesz faktów, których nie ma w danych."
                ),
            },
            {"role": "user", "content": user},
        ],
        "temperature": 0.5,
    }
    req = urllib.request.Request(
        api_url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + api_key,
            "User-Agent": "Cyklia/1.0 (raport PDF)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return facts


def build_report(user_id):
    d = _build_stats(user_id)
    d["ai_summary"] = _ai_summary(d)
    return d


def _fmt_date(s):
    if not s:
        return "—"
    d = pred._to_date(s)
    return f"{d.day:02d}.{d.month:02d}.{d.year}"


def _fmt_num(v, suffix=""):
    if v is None:
        return "—"
    s = str(v).replace(".", ",")
    return f"{s} {suffix}".strip()


def render_pdf(d):
    try:
        from fpdf import FPDF
    except ImportError as e:
        raise RuntimeError(
            "Brak biblioteki fpdf2 na serwerze — zainstaluj: pip install fpdf2"
        ) from e
    pdf = FPDF(format="A4")
    pdf.set_margin(15)
    pdf.set_auto_page_break(auto=True, margin=18)
    regular = os.path.join(FONT_DIR, "DejaVuSans.ttf")
    bold = os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf")
    pdf.add_font("DejaVu", "", regular)
    pdf.add_font("DejaVu", "B", bold)

    name = (d["user"]["display_name"] or d["user"]["email"] or "Użytkowniczka")
    today = datetime.now().strftime("%d.%m.%Y")

    def heading(text, size=12, top=6):
        pdf.ln(top)
        pdf.set_font("DejaVu", "B", size)
        pdf.set_text_color(150, 30, 80)
        pdf.multi_cell(0, 6, text=text, new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(40, 40, 40)
        pdf.ln(2)

    def para(text, size=10, color=(40, 40, 40)):
        pdf.set_font("DejaVu", "", size)
        pdf.set_text_color(*color)
        pdf.multi_cell(0, 5.2, text=text, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

    def kv(label, value):
        pdf.set_font("DejaVu", "", 10)
        pdf.set_text_color(90, 90, 90)
        pdf.multi_cell(0, 5.2, text=label + ": ", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("DejaVu", "B", 10)
        pdf.set_text_color(40, 40, 40)
        pdf.multi_cell(0, 5.2, text=value, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1.5)

    pdf.add_page()
    # Nagłówek
    pdf.set_font("DejaVu", "B", 20)
    pdf.set_text_color(150, 30, 80)
    pdf.cell(0, 9, text="Raport dla ginekologa", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", "", 10.5)
    pdf.set_text_color(90, 90, 90)
    pdf.multi_cell(
        0, 5, text=f"Cyklia · wygenerowano {today} · {name}",
        new_x="LMARGIN", new_y="NEXT",
    )
    pdf.ln(3)

    # 1. Cykle
    heading("1. Cykle i okresy", top=0)
    kv("Zarejestrowane cykle", str(d["cycle_count"]))
    kv("Średnia długość cyklu", _fmt_num(d["average_cycle"], "dni"))
    kv(
        "Zakres długości cyklu",
        _fmt_num(d["min_cycle"]) + " – " + _fmt_num(d["max_cycle"]) + " dni"
        if d["min_cycle"] and d["max_cycle"]
        else "—",
    )
    kv("Średnia długość okresu", _fmt_num(d["average_period"], "dni"))
    kv("Ostatni okres", _fmt_date(d["last_period_start"]))
    kv("Przewidywany następny okres", _fmt_date(d["next_period_start"]))
    if d["on_pills"]:
        para(
            "Użytkowniczka stosuje antykoncepcję hormonalną — owulacja jest "
            "wyciszona, a cykl to schemat tabletkowy/plastrowy.",
            size=9.5, color=(120, 90, 100),
        )

    # 2. Ostatnie cykle (tabela)
    if d["recent_cycles"]:
        heading("2. Ostatnie cykle")
        cols = [("Początek", 38), ("Koniec", 38), ("Długość cyklu", 30), ("Długość okresu", 30)]
        row_h = 6
        pdf.set_font("DejaVu", "B", 9)
        pdf.set_fill_color(247, 235, 242)
        pdf.set_text_color(150, 30, 80)
        for label, w in cols:
            pdf.cell(w, row_h, text=label, border=1, align="C", fill=True)
        pdf.ln()
        pdf.set_font("DejaVu", "", 9)
        pdf.set_text_color(40, 40, 40)
        for c in d["recent_cycles"]:
            for val, (_, w) in zip(
                [_fmt_date(c["start"]), _fmt_date(c["end"]),
                 _fmt_num(c["cycle_len"], ""), _fmt_num(c["period_len"], "")],
                cols,
            ):
                pdf.cell(w, row_h, text=val, border=1, align="C")
            pdf.ln()

    # 3. Objawy i nastrój
    heading("3. Objawy i nastrój")
    if d["top_symptoms"]:
        para("Najczęstsze objawy: " + ", ".join(
            f"{s['name']} ({s['count']}×)" for s in d["top_symptoms"]
        ))
    else:
        para("Brak zapisanych objawów.")
    if d["top_moods"]:
        para("Najczęstsze nastroje: " + ", ".join(
            f"{m['name']} ({m['count']}×)" for m in d["top_moods"]
        ))
    for ps in d["phase_symptoms"]:
        items = ", ".join(f"{s['name']} ({s['count']}×)" for s in ps["symptoms"])
        para(f"• {ps['phase']}: {items}", size=9.5)

    # 4. Pomiary
    heading("4. Pomiary i styl życia")
    kv("Średni sen", _fmt_num(d["average_sleep"], "godz."))
    kv("Średnia aktywność", _fmt_num(d["average_activity"], "min"))
    kv("Suma kroków", _fmt_num(d["total_steps"]))
    kv("Średnia temperatura", _fmt_num(d["average_temp"], "°C"))
    kv("Ostatnia temperatura", _fmt_num(d["last_temp"], "°C"))
    kv("Liczba wpisów w dzienniku", str(d["entry_count"]))

    # 5. Podsumowanie AI
    heading("5. Podsumowanie dla ginekologa")
    para(d["ai_summary"])

    pdf.set_font("DejaVu", "", 8)
    pdf.set_text_color(140, 140, 140)
    pdf.multi_cell(
        0, 4.5,
        text="Raport wygenerowany automatycznie w aplikacji Cyklia na podstawie "
             "wpisów użytkowniczki. Nie stanowi diagnozy ani dokumentacji medycznej.",
        new_x="LMARGIN", new_y="NEXT",
    )

    return bytes(pdf.output())
