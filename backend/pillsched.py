# -*- coding: utf-8 -*-
"""Kotwica harmonogramu tabletek (dzień 1 bieżącego blistra)."""
from datetime import datetime, timedelta

import database as db
import localtime


def _break_days(user):
    v = user.get("pill_break_days")
    return int(v) if v is not None else 7


def pill_anchor(user_id, user):
    """Dzień 1 bieżącego blistra.

    Szuka w dzienniku tabletek ostatniego „początku blistra”, czyli wpisu,
    przed którym była przerwa (brak wpisów przez kilka dni). Dzięki temu
    wcześniej rozpoczęty blister przesuwa prognozę okresu wcześniej, a
    codzienne zaznaczanie tabletek NIE przesuwa kotwicy (wcześniej brano
    najstarszy wpis z ostatnich 28 dni, który zmieniał się każdego dnia).

    Gdy w ostatnim cyklu nie ma wpisów — data rozpoczęcia z profilu.
    """
    active = int(user.get("pill_cycle_days") or 21)
    brk = _break_days(user)
    total = active + brk
    profile_start = user.get("pill_start_date") or None
    today = localtime.today()

    if brk == 0:
        # Tabletki bez przerwy — kotwica ma znaczenie tylko informacyjne.
        return profile_start

    rows = db.query(
        "SELECT date FROM pill_logs WHERE user_id = ? AND date <= ? ORDER BY date",
        (user_id, today.isoformat()),
    )
    dates = []
    for r in rows:
        try:
            dates.append(datetime.strptime(r["date"], "%Y-%m-%d").date())
        except (TypeError, ValueError):
            continue

    # Przerwa w logowaniu uznawana za przerwę między blistrami. Tolerujemy
    # krótszą przerwę (wcześniejszy start nowego blistra), ale pojedynczy
    # zapomniany wpis nie resetuje blistra.
    gap_needed = max(2, (brk + 1) // 2 + 1)
    pack_start = None
    prev = None
    for d in dates:
        if prev is None or (d - prev).days >= gap_needed:
            pack_start = d
        prev = d

    if pack_start and pack_start > today - timedelta(days=total):
        return pack_start.isoformat()
    if profile_start:
        return profile_start
    return pack_start.isoformat() if pack_start else None
