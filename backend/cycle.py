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


def build_calendar(start_dates, cycle_length=None, period_length=None):
    """Zwraca prognozę na podstawie listy dat rozpoczęcia okresów."""
    start_dates = sorted(set(parse_date(s) if isinstance(s, str) else s for s in start_dates))
    cycle = cycle_length or average_cycle_length(start_dates)

    if not start_dates:
        return {
            "has_data": False,
            "next_period_start": None,
            "ovulation_date": None,
            "fertile_start": None,
            "fertile_end": None,
            "cycle_length": cycle,
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
        "next_period_start": iso(next_start),
        "ovulation_date": iso(ovulation),
        "fertile_start": iso(fertile_start),
        "fertile_end": iso(fertile_end),
        "cycle_length": cycle,
    }


def day_type_for(day, cycle_starts, period_end_dates, prediction):
    """Klasyfikuje dzień: okres / płodny / owulacja / normalny."""
    day = parse_date(day)
    for s in cycle_starts:
        s = parse_date(s)
        e = None
        # okres trwa domyślnie 5 dni, chyba że podano koniec
        matching_end = next(
            (parse_date(x) for x in period_end_dates if parse_date(x) >= s),
            None,
        )
        e = matching_end or s + timedelta(days=4)
        if s <= day <= e:
            return "period"

    if prediction.get("has_data"):
        ov = parse_date(prediction["ovulation_date"])
        fs = parse_date(prediction["fertile_start"])
        fe = parse_date(prediction["fertile_end"])
        if fs <= day <= fe:
            if day == ov:
                return "ovulation"
            return "fertile"

    return "normal"
