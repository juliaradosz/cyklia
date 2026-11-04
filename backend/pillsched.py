# -*- coding: utf-8 -*-
"""Kotwica harmonogramu tabletek (dzień 1 bieżącego blistra)."""
from datetime import datetime, timedelta

import database as db
import localtime


def _break_days(user):
    v = user.get("pill_break_days")
    return int(v) if v is not None else 7


def pill_anchor(user_id, user):
    """Dzień 1 bieżącego blistra, wyliczany z faktycznie zaznaczonych tabletek.

    Zasady (przechodzimy po wpisach od najstarszego):
    - punkt wyjścia: data startu blistra z profilu (jeśli jest),
    - tabletka zaznaczona w dniu, który wg harmonogramu jest PRZERWĄ, oznacza
      rozpoczęcie nowego blistra wcześniej → nowy blister liczy się od tego dnia,
    - tabletka po dłuższej niż przerwa luce (brak wpisów) też rozpoczyna nowy
      blister (start później niż planowo),
    - tabletka w dniu aktywnym trzyma się harmonogramu (pojedynczy zapomniany
      wpis nic nie przesuwa).
    Dzięki temu okres zawsze wypada kilka dni po ostatniej tabletce z blistra.
    """
    active = int(user.get("pill_cycle_days") or 21)
    brk = _break_days(user)
    total = active + brk
    profile_start = user.get("pill_start_date") or None
    today = localtime.today()

    anchor = None
    if profile_start:
        try:
            anchor = datetime.strptime(profile_start, "%Y-%m-%d").date()
        except ValueError:
            anchor = None

    rows = db.query(
        "SELECT date FROM pill_logs WHERE user_id = ? AND date <= ? ORDER BY date",
        (user_id, today.isoformat()),
    )
    prev = None
    for r in rows:
        try:
            d = datetime.strptime(r["date"], "%Y-%m-%d").date()
        except (TypeError, ValueError):
            continue
        if anchor is None:
            anchor = d
        else:
            pos = (d - anchor).days
            if pos < 0:
                # wpis sprzed daty startu z profilu — ignorujemy
                continue
            if brk == 0:
                anchor = anchor + timedelta(days=(pos // total) * total)
            elif prev is not None and (d - prev).days > brk + 1 and pos % total != 0:
                # dłuższa przerwa niż w schemacie → nowy blister od dziś
                anchor = d
            elif pos % total >= active:
                # tabletka w dniu przerwy → nowy blister zaczęty wcześniej
                anchor = d
            else:
                anchor = anchor + timedelta(days=(pos // total) * total)
        prev = d

    return anchor.isoformat() if anchor else None
