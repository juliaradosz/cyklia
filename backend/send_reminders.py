# -*- coding: utf-8 -*-
"""Wysyła należne przypomnienia push (tabletka, plaster, okres, dni płodne).

Uruchamiane z konsoli / zadania zaplanowanego PythonAnywhere:
    cd ~/cyklia/backend && ../venv/bin/python send_reminders.py

Opcja --key wypisuje sekretny klucz do adresu /api/cron/reminders?key=...
"""
import json
import sys

import database as db

db.init_db()

import notify  # noqa: E402

if __name__ == "__main__":
    if "--key" in sys.argv:
        print(notify.cron_key())
        sys.exit(0)
    print(json.dumps(notify.run_reminders(), ensure_ascii=False, indent=2))
