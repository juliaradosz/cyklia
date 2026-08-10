# -*- coding: utf-8 -*-
"""
Plastry antykoncepcyjne (transdermalne) — baza informacyjna.
Schemat standardowy: 3 tygodnie noszenia plastra (zmiana co 7 dni,
czyli plaster nr 1, 2, 3) + 1 tydzień przerwy = 28 dni.

Uwaga: lista ma charakter edukacyjny. Zawsze zweryfikuj swój schemat
z ulotką lub farmaceutą / lekarzem.
"""

PATCHES = [
    {
        "name": "Evra",
        "type": "złożone",
        "active": 21,
        "break": 7,
        "hormones": "norelgestromin 150 µg + etynyloestradiol 20 µg / dobę",
        "description": (
            "Najpopularniejszy plaster antykoncepcyjny dostępny w Europie. "
            "Klejony na skórę raz w tygodniu przez 3 tygodnie, potem tydzień "
            "przerwy."
        ),
    },
    {
        "name": "Xulane",
        "type": "złożone",
        "active": 21,
        "break": 7,
        "hormones": "norelgestromin 150 µg + etynyloestradiol 20 µg / dobę",
        "description": (
            "Odpowiednik Evry (generyk). Ten sam schemat 21+7 — naklejaj nowy "
            "plaster co 7 dni, trzy razy, potem tydzień przerwy."
        ),
    },
    {
        "name": "Twirla",
        "type": "złożone",
        "active": 21,
        "break": 7,
        "hormones": "lewonorgestrel 120 µg + etynyloestradiol 30 µg / dobę",
        "description": (
            "Plaster o nieco niższej dawce lewonorgestrelu. Zmiana plastra "
            "co 7 dni przez 3 tygodnie, potem 7 dni przerwy."
        ),
    },
    {
        "name": "Zafemy",
        "type": "złożone",
        "active": 21,
        "break": 7,
        "hormones": "norelgestromin 150 µg + etynyloestradiol 20 µg / dobę",
        "description": (
            "Generyk plastra z norelgestrominem. Standardowy schemat 21+7."
        ),
    },
    {
        "name": "Lurvelle",
        "type": "złożone",
        "active": 21,
        "break": 7,
        "hormones": "norelgestromin 150 µg + etynyloestradiol 20 µg / dobę",
        "description": (
            "Generyk plastra antykoncepcyjnego. Schemat: 3 tygodnie plastra, "
            "tydzień przerwy."
        ),
    },
]

PATCH_KNOWLEDGE = [
    {
        "title": "Jak działają plastry?",
        "body": (
            "Plaster uwalnia hormony przez skórę wprost do krwiobiegu — omija "
            "przewód pokarmowy, więc nie traci skuteczności przy wymiotach czy "
            "biegunce. Zawiera estrogen i progestagen (jak tabletki złożone), "
            "więc hamuje owulację, zagęszcza śluz i rozrzedza błonę śluzową macicy."
        ),
    },
    {
        "title": "Schemat stosowania",
        "body": (
            "Naklej pierwszy plaster w 1. dniu okresu (albo 1. niedzielę po nim — "
            "zgodnie z ulotką). Noś go 7 dni, potem zmień na nowy — zawsze w ten "
            "sam dzień tygodnia. Po 3 tygodniach (plaster nr 1, 2, 3) robisz 7 dni "
            "przerwy, w trakcie której pojawia się krwawienie z odstawienia. "
            "Potem zaczynasz kolejny cykl."
        ),
    },
    {
        "title": "Gdzie naklejać plaster?",
        "body": (
            "Na czystą, suchą, pozbawioną podrażnień skórę: pośladek, brzuch, "
            "górna część ramienia albo górna część tułowia (bez biustu). "
            "Zmieniaj okolicę z cyklu na cykl, żeby nie podrażniać skóry. "
            "Nie przyklejaj na biust, w miejsca po kremach/balsamach ani "
            "na bieliznę."
        ),
    },
    {
        "title": "Jeśli plaster się odklei",
        "body": (
            "Gdy plaster odklei się na mniej niż 24 h — przyklej go z powrotem "
            "w to samo miejsce albo załóż nowy i nie zmieniaj dnia zmiany. "
            "Gdy odkleił się na dłużej niż 24 h — załóż nowy plaster i nie "
            "zmieniaj dnia zmiany, ale przez 7 dni stosuj dodatkową ochronę "
            "(np. prezerwatywę). Sprawdź zawsze ulotkę swojego preparatu."
        ),
    },
    {
        "title": "Zalety plastra",
        "body": (
            "Wystarczy pamiętać o zmianie raz w tygodniu (nie codziennie), "
            "dawka hormonów jest stała przez cały tydzień, a skuteczność nie "
            "zależy od trawienia. Skuteczność przy typowym stosowaniu to "
            "ok. 91%."
        ),
    },
    {
        "title": "Wady i uwagi",
        "body": (
            "U części osób plaster jest widoczny lub odkleja się przy intensywnej "
            "aktywności/poceniu. Możliwe efekty uboczne na początku: ból piersi, "
            "mdłości, plamienia, podrażnienie skóry. Ryzyko zakrzepicy jest niskie, "
            "ale wyższe niż przy samych progestagenach — omów z lekarzem, zwłaszcza "
            "jeśli palisz lub masz migreny z aurą."
        ),
    },
    {
        "title": "Co gdy zapomnę o zmianie?",
        "body": (
            "Masz do 48 godzin po terminie, by zmienić plaster bez utraty ochrony "
            "(a przy niektórych preparatach nawet 24–48 h — sprawdź ulotkę). "
            "Po tym czasie załóż nowy plaster i stosuj dodatkową antykoncepcję "
            "przez 7 dni. Gdy przerwa trwała dłużej niż 7 dni, przed nowym cyklem "
            "skonsultuj się z lekarzem."
        ),
    },
]

SCHEDULE = {
    "active": 21,
    "break": 7,
    "change_every": 7,
}
