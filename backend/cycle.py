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
    """Klasyfikuje dzień: okres / płodny / owulacja / normalny.

    period_end_dates[i] odpowiada cycle_starts[i]; wartość pusta (None / "")
    oznacza otwarty cykl bez zakończenia (okres szacowany na period_length dni).
    """
    day = parse_date(day)
    per = int(prediction.get("period_length") or 5)
    for i, s in enumerate(cycle_starts):
        s = parse_date(s)
        e = None
        if i < len(period_end_dates) and period_end_dates[i]:
            e = parse_date(period_end_dates[i])
        if e is None:
            e = s + timedelta(days=per - 1)
        if s <= day <= e:
            return "period"

    if prediction.get("on_pills"):
        # Przy tabletkach kalendarz NIE podpowiada okresu — okres zaznacza
        # wyłącznie użytkowniczka (zarejestrowane cykle). Brak owulacji
        # i dni płodnych.
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


def pill_active(day, pill_start, pill_cycle, pill_break):
    """Czy w danym dniu przyjmuje się tabletkę (czyli czy dzień nie wypada
    w przerwie między blistrami). Opiera się wyłącznie na dacie rozpoczęcia
    przyjmowania (pill_start) i schemacie — NIE wpływa na okres w kalendarzu.
    """
    active = max(int(pill_cycle or 21), 1)
    brk = max(int(pill_break or 0), 0)
    if brk == 0:
        return True
    if not pill_start:
        return True
    d = parse_date(day)
    ps = parse_date(pill_start)
    return ((d - ps).days % (active + brk)) < active
