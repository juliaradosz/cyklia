# -*- coding: utf-8 -*-
"""Czas lokalny użytkowniczek (domyślnie Polska).

Serwer PythonAnywhere działa w UTC, więc ``date.today()`` / ``datetime.now()``
dawały złą datę między północą a 1:00/2:00 i złą godzinę przyjęcia tabletki.
Strefę można zmienić zmienną środowiskową ``CYKLIA_TZ``.
"""
import os
from datetime import datetime, timedelta, timezone

TZ_NAME = os.environ.get("CYKLIA_TZ", "Europe/Warsaw")

try:
    from zoneinfo import ZoneInfo

    TZ = ZoneInfo(TZ_NAME)
except Exception:  # brak bazy stref czasowych (np. Windows bez tzdata)
    TZ = None


def _fallback_offset(utc_now):
    """Przybliżenie czasu polskiego bez bazy stref: CEST od ostatniej niedzieli
    marca do ostatniej niedzieli października (01:00 UTC)."""
    y = utc_now.year

    def last_sunday(month):
        d = datetime(y, month, 31 if month in (3, 10) else 30, 1, tzinfo=timezone.utc)
        while d.weekday() != 6:
            d -= timedelta(days=1)
        return d

    summer = last_sunday(3) <= utc_now < last_sunday(10)
    return timedelta(hours=2 if summer else 1)


def now():
    """Aktualna data i godzina lokalnie (naive datetime)."""
    utc_now = datetime.now(timezone.utc)
    if TZ is not None:
        return utc_now.astimezone(TZ).replace(tzinfo=None)
    return (utc_now + _fallback_offset(utc_now)).replace(tzinfo=None)


def today():
    return now().date()


def today_iso():
    return today().isoformat()


def now_hm():
    return now().strftime("%H:%M")
