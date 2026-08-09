# -*- coding: utf-8 -*-
"""
Baza popularnych doustnych środków antykoncepcyjnych (do celów informacyjnych).
Regimen opisuje: ile dni przyjmuje się tabletki aktywne (active) i ile dni
trwa przerwa / przyjmowanie placebo (break). Proszę zawsze zweryfikować swój
schemat z ulotką lub farmaceutą.
"""

PILLS = [
    # --- Złożone, standardowy schemat 21+7 ---
    {"name": "Yasmin", "type": "złożone", "active": 21, "break": 7},
    {"name": "Vibin Mini", "type": "złożone", "active": 21, "break": 7},
    {"name": "Sibilla", "type": "złożone", "active": 21, "break": 7},
    {"name": "Symicia", "type": "złożone", "active": 21, "break": 7},
    {"name": "Oelair", "type": "złożone", "active": 21, "break": 7},
    {"name": "Diane-35", "type": "złożone", "active": 21, "break": 7},
    {"name": "Belara", "type": "złożone", "active": 21, "break": 7},
    {"name": "Cilest", "type": "złożone", "active": 21, "break": 7},
    {"name": "Marvelon", "type": "złożone", "active": 21, "break": 7},
    {"name": "Mercilon", "type": "złożone", "active": 21, "break": 7},
    {"name": "Microgynon 30", "type": "złożone", "active": 21, "break": 7},
    {"name": "Minisiston 20", "type": "złożone", "active": 21, "break": 7},
    {"name": "Logest", "type": "złożone", "active": 21, "break": 7},
    {"name": "Novynette", "type": "złożone", "active": 21, "break": 7},
    {"name": "Aubra", "type": "złożone", "active": 21, "break": 7},
    # --- Złożone, schemat 24+4 ---
    {"name": "Yaz", "type": "złożone", "active": 24, "break": 4},
    {"name": "Vixea", "type": "złożone", "active": 24, "break": 4},
    {"name": "Zoely", "type": "złożone", "active": 24, "break": 4},
    # --- Złożone, schemat 26+2 ---
    {"name": "Qlaira", "type": "złożone", "active": 26, "break": 2},
    # --- Progestagenowe (bez przerwy lub krótka) ---
    {"name": "Slinda", "type": "progestagenowe", "active": 24, "break": 4},
    {"name": "Slynd", "type": "progestagenowe", "active": 24, "break": 4},
    {"name": "Cerazette", "type": "progestagenowe", "active": 28, "break": 0},
    {"name": "Azalia", "type": "progestagenowe", "active": 28, "break": 0},
]
