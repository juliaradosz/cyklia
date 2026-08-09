# -*- coding: utf-8 -*-
import database as db

ARTICLES = [
    {
        "title": "Jak działa cykl miesiączkowy?",
        "category": "Podstawy",
        "summary": "Zrozum cztery fazy cyklu i to, jak hormony wpływają na Twoje samopoczucie.",
        "content": (
            "Cykl miesiączkowy liczymy od pierwszego dnia okresu do dnia poprzedzającego "
            "kolejną miesiączkę. Średnio trwa 28 dni, ale zupełnie normalne są cykle "
            "trwające od 21 do 35 dni.\n\n"
            "Faza 1 — menstruacyjna (dni 1-5): złuszczanie się błony śluzowej macicy. "
            "Poziom hormonów jest najniższy.\n\n"
            "Faza 2 — folikularna (dni 1-13): dojrzewa pęcherzyk z komórką jajową, rośnie "
            "poziom estrogenu, czujesz więcej energii.\n\n"
            "Faza 3 — owulacyjna (ok. dnia 14): uwolnienie komórki jajowej. Szansa na "
            "zapłodnienie jest największa.\n\n"
            "Faza 4 — lutealna (dni 15-28): wzrasta progesteron, mogą pojawić się objawy "
            "PMS. Jeśli nie dojdzie do zapłodnienia, zaczyna się kolejna miesiączka.\n\n"
            "Obserwacja własnego cyklu pomaga lepiej rozumieć swoje ciało — jego rytm, "
            "nastrój i potrzeby. To wiedza dająca sprawczość, nie tylko liczby w kalendarzu."
        ),
    },
    {
        "title": "Objawy PMS i jak je łagodzić",
        "category": "Dobre samopoczucie",
        "summary": "Napięcie, drażliwość, ból piersi — jak złagodzić typowe objawy PMS.",
        "content": (
            "Zespół napięcia przedmiesiączkowego (PMS) dotyczy nawet 3 na 4 kobiet "
            "w wieku rozrodczym. Typowe objawy to: wahania nastroju, drażliwość, ból "
            "piersi, wzdęcia, bóle głowy, zmęczenie i zaburzenia snu.\n\n"
            "Co pomaga:\n"
            "- regularny umiarkowany ruch (spacer, joga, pływanie)\n"
            "- sen 7-8 godzin i stały rytm dobowy\n"
            "- ograniczenie kawy, soli i cukru w drugiej fazie cyklu\n"
            "- magnez i witamina B6 (skonsultuj suplementację z lekarzem)\n"
            "- ciepłe okłady na podbrzusze przy skurczach\n\n"
            "Prowadzenie dziennika objawów pozwala dostrzec cykliczność dolegliwości i "
            "przygotować się na trudniejsze dni. Jeśli objawy poważnie utrudniają "
            "codzienne funkcjonowanie, porozmawiaj z ginekologiem — czasem za PMS "
            "stoi zaburzenie dysforyczne (PMDD) lub inne problemy hormonalne."
        ),
    },
    {
        "title": "Temperatura bazowa — jak i po co ją mierzyć",
        "category": "Zdrowie",
        "summary": "Pomiar temperatury bazowej pomaga potwierdzić owulację. Sprawdź, jak to robić poprawnie.",
        "content": (
            "Temperatura bazowa (BBT) to temperatura ciała tuż po przebudzeniu, na czczo, "
            "zanim wstaniesz z łóżka. Po owulacji wzrasta o około 0,2-0,5°C i pozostaje "
            "podwyższona do końca cyklu.\n\n"
            "Zasady pomiaru:\n"
            "- mierz zawsze o podobnej porze (najlepiej w dopochwowo lub doustnie)\n"
            "- mierz po minimum 3-4 godzinach snu\n"
            "- notuj wynik codziennie, w tym w weekendy\n"
            "- choroba, alkohol i zmiana rytmu snu mogą zaburzyć pomiar — zapisz to\n\n"
            "Ciągły wzrost temperatury przez 3 kolejne dni to najpewniejsza oznaka, że "
            "owulacja już się odbyła. Sam pomiar nie przewidzi jej wcześniej, dlatego "
            "łącz go z obserwacją śluzu i kalendarzem."
        ),
    },
    {
        "title": "Śluz szyjkowy — naturalny sygnał płodności",
        "category": "Podstawy",
        "summary": "Obserwacja śluzu szyjkowego to darmowa i skuteczna metoda poznania swojej płodności.",
        "content": (
            "Pod wpływem estrogenu śluz szyjkowy zmienia konsystencję w trakcie cyklu. "
            "To jeden z najbardziej naturalnych wskaźników płodności.\n\n"
            "- bezpośrednio po okresie: śluzu mało lub nie ma go wcale\n"
            "- przed owulacją: śluz staje się mętny i kleisty\n"
            "- szczyt płodności: śluz jest przejrzysty, rozciągliwy, przypomina białko "
            "jajka — to najlepszy moment na staranie się o dziecko\n"
            "- po owulacji: śluz gęstnieje i zanika\n\n"
            "Obserwacja śluzu w połączeniu z temperaturą i kalendarzem daje dużą "
            "skuteczność w wyznaczaniu dni płodnych. Pamiętaj jednak, że metoda ta "
            "wymaga systematyczności i nie jest niezawodną antykoncepcją."
        ),
    },
    {
        "title": "Nieregularne cykle — kiedy się niepokoić?",
        "category": "Zdrowie",
        "summary": "Odchylenia długości cyklu są naturalne, ale niektóre sygnały warto skonsultować z lekarzem.",
        "content": (
            "Nieregularność to najczęstsza skarga dotycząca cyklu. Do 20-30% kobiet "
            "ma cykle o różnej długości — różnice do 7 dni między kolejnymi cyklami "
            "są normalne, szczególnie u młodych kobiet i tuż przed menopauzą.\n\n"
            "Czynniki wpływające na regularność: stres, zmiana wagi, intensywny trening, "
            "podróże, zaburzenia snu, choroby tarczycy, PCOS.\n\n"
            "Skonsultuj się z ginekologiem, jeśli:\n"
            "- cykli nie ma przez ponad 3 miesiące\n"
            "- okresy są bardzo obfite (zmiana podpaski co godzinę)\n"
            "- masz bardzo silne bóle nieustępujące po lekach\n"
            "- krwawienia pojawiają się między okresami\n\n"
            "Aplikacja pomoże Ci śledzić długość cykli — wydrukowana historia wpisów "
            "to świetny materiał na wizytę u lekarza."
        ),
    },
    {
        "title": "Odżywianie w rytmie cyklu",
        "category": "Dobre samopoczucie",
        "summary": "Dopasuj dietę do faz cyklu, by czuć się lepiej przez cały miesiąc.",
        "content": (
            "Zamiast jednej sztywnej diety, warto wspierać organizm zgodnie z fazami "
            "cyklu:\n\n"
            "Faza menstruacyjna: regeneracja. Sięgaj po żelazo (zielone warzywa, "
            "strączki), witaminę C (cytrusy, papryka) i magnez (orzechy, kakao). "
            "Pij dużo wody.\n\n"
            "Faza folikularna: energia rośnie. Świetny moment na błonnik, kiszonki i "
            "pełne ziarna.\n\n"
            "Faza owulacyjna: jedz lekkie posiłki bogate w warzywa i białko, wspieraj "
            "detoks (brokuły, kalafior).\n\n"
            "Faza lutealna: spada tolerancja glukozy — postaw na białko, zdrowe "
            "tłuszcze (awokado, ryby), ogranicz cukier i kawę. Kompleks B i magnez "
            "łagodzą PMS.\n\n"
            "Najważniejsza zasada: słuchaj swojego ciała. To, co działa na jedną "
            "osobę, nie musi działać na inną."
        ),
    },
]

CATEGORIES = ["Podstawy", "Zdrowie", "Dobre samopoczucie"]


def seed():
    db.init_db()
    existing = db.query("SELECT COUNT(*) AS c FROM articles")
    if existing[0]["c"] > 0:
        return
    for a in ARTICLES:
        db.execute(
            "INSERT INTO articles (title, category, summary, content, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (a["title"], a["category"], a["summary"], a["content"], db.now_iso()),
        )
    print(f"Zasiano {len(ARTICLES)} artykułów.")


if __name__ == "__main__":
    seed()
