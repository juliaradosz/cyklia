from datetime import date, datetime, timedelta


def parse_date(s):
    return datetime.strptime(s, "%Y-%m-%d").date()


def iso(d):
    return d.isoformat()


def average_cycle_length(start_dates, default=28):
    parsed = sorted(parse_date(s) if isinstance(s, str) else s for s in start_dates)
    if len(parsed) >= 2:
        diffs = [
            (b - a).days
            for a, b in zip(parsed[:-1], parsed[1:])
            if (b - a).days > 0
        ]
        if diffs:
            return int(round(sum(diffs) / len(diffs)))
    return default


def build_calendar(
    start_dates,
    cycle_length=None,
    period_length=None,
    pills=False,
    pill_cycle=21,
    pill_break=7,
    method=None,
    pill_start=None,
):
    """Zwraca prognozę na podstawie listy dat rozpoczęcia okresów.

    pills=True → tryb antykoncepcji hormonalnej: brak owulacji i dni płodnych,
    kolejna miesiączka przewidywana w przerwie między blistrami / plastrami.
    method: "pill" | "patch" | None — typ antykoncepcji.
    pill_start: data rozpoczęcia przyjmowania tabletek (kotwica schematu);
    wtedy przerwa liczona jest od dnia: pill_start + pill_cycle dni, cykl
    powtarza się co (pill_cycle + pill_break) dni.
    """
    start_dates = sorted(set(parse_date(s) if isinstance(s, str) else s for s in start_dates))
    per = int(period_length or 5)

    if pills:
        active = max(int(pill_cycle), 1)
        brk = max(int(pill_break), 0)
        total = active + brk
        if pill_start:
            ps = parse_date(pill_start)
            today = date.today()
            idx = (today - ps).days
            anchor = ps + timedelta(days=(idx // total) * total)
            active_end = anchor + timedelta(days=active - 1)
            next_start = (
                anchor + timedelta(days=total)
                if today > active_end
                else anchor + timedelta(days=active)
            )
            return {
                "has_data": True,
                "on_pills": True,
                "method": method,
                "next_period_start": iso(next_start),
                "ovulation_date": None,
                "fertile_start": None,
                "fertile_end": None,
                "cycle_length": total,
                "period_length": per,
                "pill_break_days": brk,
            }
        if not start_dates:
            return {
                "has_data": False,
                "on_pills": True,
                "method": method,
                "next_period_start": None,
                "ovulation_date": None,
                "fertile_start": None,
                "fertile_end": None,
                "cycle_length": total,
                "period_length": per,
                "pill_break_days": int(pill_break),
            }
        last = start_dates[-1]
        next_start = last + timedelta(days=total)
        today = date.today()
        while next_start <= today:
            next_start += timedelta(days=total)
        return {
            "has_data": True,
            "on_pills": True,
            "method": method,
            "next_period_start": iso(next_start),
            "ovulation_date": None,
            "fertile_start": None,
            "fertile_end": None,
            "cycle_length": total,
            "period_length": per,
            "pill_break_days": int(pill_break),
        }

    cycle = cycle_length or average_cycle_length(start_dates)

    if not start_dates:
        return {
            "has_data": False,
            "on_pills": False,
            "method": None,
            "next_period_start": None,
            "ovulation_date": None,
            "fertile_start": None,
            "fertile_end": None,
            "cycle_length": cycle,
            "period_length": per,
            "pill_break_days": None,
        }

    last = start_dates[-1]
    today = date.today()
    # Przewidywany kolejny okres może wypaść przed dziś, jeśli cykl się opóźnia.
    next_start = last + timedelta(days=cycle)
    while next_start <= today:
        next_start += timedelta(days=cycle)

    ovulation = next_start - timedelta(days=14)
    fertile_start = ovulation - timedelta(days=5)
    fertile_end = ovulation + timedelta(days=1)

    return {
        "has_data": True,
        "on_pills": False,
        "method": None,
        "next_period_start": iso(next_start),
        "ovulation_date": iso(ovulation),
        "fertile_start": iso(fertile_start),
        "fertile_end": iso(fertile_end),
        "cycle_length": cycle,
        "period_length": per,
        "pill_break_days": None,
    }


def day_type_for(day, cycle_starts, period_end_dates, prediction):
    """Klasyfikuje dzień: okres / płodny / owulacja / normalny."""
    day = parse_date(day)
    for s in cycle_starts:
        s = parse_date(s)
        matching_end = next(
            (parse_date(x) for x in period_end_dates if parse_date(x) >= s),
            None,
        )
        e = matching_end or s + timedelta(days=4)
        if s <= day <= e:
            return "period"

    if prediction.get("on_pills"):
        # przy tabletkach brak owulacji/dni płodnych; ewentualny okres
        # przewidywany jest w przerwie między blistrami
        nxt = prediction.get("next_period_start")
        brk = prediction.get("pill_break_days")
        if brk is None:
            brk = 7
        if nxt:
            p = parse_date(nxt)
            p_end = p + timedelta(days=brk - 1)
            if p <= day <= p_end:
                return "period"
        return "normal"

    if prediction.get("has_data") and prediction.get("ovulation_date"):
        ov = parse_date(prediction["ovulation_date"])
        fs = parse_date(prediction["fertile_start"])
        fe = parse_date(prediction["fertile_end"])
        if fs <= day <= fe:
            if day == ov:
                return "ovulation"
            return "fertile"

    return "normal"
