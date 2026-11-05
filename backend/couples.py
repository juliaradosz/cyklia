"""Funkcje dla par: codzienny quiz, pomysły na randkę, podpowiedzi dla partnera
i „Czego dziś potrzebuję”."""

import random

# ---------- Quiz dla par (codziennie inny temat) ----------

QUIZ_TOPICS = [
    {
        "topic": "Podróże",
        "emoji": "✈️",
        "questions": [
            {"q": "Idealny urlop to…", "options": ["Plaża i leżak", "Góry i szlaki", "Zwiedzanie miasta", "Road trip bez planu"]},
            {"q": "Jak planujecie wyjazd?", "options": ["Wszystko rozpisane", "Tylko nocleg, reszta na miejscu", "Spontan — pakujemy się i jedziemy"]},
            {"q": "Nocleg marzeń", "options": ["Hotel ze śniadaniem", "Domek w lesie", "Namiot pod gwiazdami", "Apartament w centrum"]},
            {"q": "Na wyjeździe najważniejsze jest…", "options": ["Jedzenie", "Widoki", "Odpoczynek", "Przygoda"]},
            {"q": "Gdzie najchętniej pojechalibyście razem?", "options": ["Włochy", "Skandynawia", "Azja", "Polskie morze lub góry"]},
        ],
    },
    {
        "topic": "Jedzenie",
        "emoji": "🍝",
        "questions": [
            {"q": "Wspólna kolacja to raczej…", "options": ["Gotujemy razem", "Zamawiamy jedzenie", "Wychodzimy do restauracji"]},
            {"q": "Kuchnia numer jeden", "options": ["Włoska", "Azjatycka", "Polska domowa", "Meksykańska"]},
            {"q": "Śniadanie w weekend", "options": ["Jajecznica", "Naleśniki lub gofry", "Owsianka", "Kawa wystarczy"]},
            {"q": "Słodkie czy słone przekąski?", "options": ["Słodkie", "Słone", "Jedno i drugie naraz"]},
            {"q": "Pizza z ananasem?", "options": ["Tak, uwielbiam", "Nigdy w życiu", "Mogę zjeść, bez szału"]},
        ],
    },
    {
        "topic": "Romantyzm",
        "emoji": "💌",
        "questions": [
            {"q": "Najbardziej romantyczny gest to…", "options": ["List lub liścik", "Niespodziewany prezent", "Wspólnie spędzony czas", "Pomoc, gdy jest ciężko"]},
            {"q": "Idealna rocznica", "options": ["Kolacja we dwoje", "Krótki wyjazd", "Spokojny dzień w domu", "Coś zupełnie nowego"]},
            {"q": "Kwiaty bez okazji?", "options": ["Zawsze tak", "Wolę coś praktycznego", "Raz na jakiś czas — miło"]},
            {"q": "Twój język miłości", "options": ["Słowa", "Dotyk", "Czas razem", "Gesty i pomoc", "Prezenty"]},
            {"q": "Pierwszy taniec na weselu / ulubiona piosenka to…", "options": ["Klasyka i ballada", "Coś do śpiewania razem", "Coś zaskakującego", "Nie tańczymy 😅"]},
        ],
    },
    {
        "topic": "Codzienność",
        "emoji": "🏡",
        "questions": [
            {"q": "Kto częściej zmywa?", "options": ["Ja", "Partner/partnerka", "Zmywarka i po równo"]},
            {"q": "Idealny poranek", "options": ["Wstaję wcześnie i działam", "Śpię jak najdłużej", "Powoli, z kawą w łóżku"]},
            {"q": "Porządek w domu", "options": ["Musi być idealnie", "Kontrolowany chaos", "Sprzątamy, gdy przychodzą goście"]},
            {"q": "Temperatura w sypialni", "options": ["Chłodno i okno otwarte", "Ciepło pod kołdrą", "Mamy o to spory 😄"]},
            {"q": "Najlepszy sposób na odpoczynek po pracy", "options": ["Serial", "Spacer lub sport", "Drzemka", "Rozmowa przy herbacie"]},
        ],
    },
    {
        "topic": "Przyszłość",
        "emoji": "🔮",
        "questions": [
            {"q": "Gdzie chcielibyście mieszkać za 10 lat?", "options": ["Duże miasto", "Dom pod miastem", "Wieś i natura", "Za granicą"]},
            {"q": "Zwierzak w domu?", "options": ["Pies", "Kot", "Oba!", "Na razie nie"]},
            {"q": "Wspólne konto czy osobne?", "options": ["Wspólne", "Osobne", "Wspólne na dom + osobne własne"]},
            {"q": "Największe marzenie na najbliższe lata", "options": ["Własne mieszkanie/dom", "Podróż życia", "Rozwój zawodowy", "Spokój i zdrowie"]},
            {"q": "Ślub (albo jego wspomnienie) to…", "options": ["Wielkie wesele", "Kameralnie z najbliższymi", "Tylko my dwoje", "Nie potrzebujemy papierka"]},
        ],
    },
    {
        "topic": "Rozrywka",
        "emoji": "🎬",
        "questions": [
            {"q": "Wieczór filmowy — gatunek", "options": ["Komedia romantyczna", "Thriller lub horror", "Fantasy / sci-fi", "Dokument"]},
            {"q": "Gry planszowe", "options": ["Uwielbiam rywalizację", "Tylko kooperacyjne", "Wolę coś innego"]},
            {"q": "Koncert czy kino?", "options": ["Koncert", "Kino", "Teatr lub stand-up"]},
            {"q": "Seriale oglądamy…", "options": ["Razem, nikt nie ogląda bez drugiej osoby!", "Każdy swoje", "Maraton w weekend"]},
            {"q": "Idealna sobota", "options": ["Impreza ze znajomymi", "Wycieczka za miasto", "Kocyk i dom", "Sport i aktywność"]},
        ],
    },
    {
        "topic": "Wspomnienia",
        "emoji": "📸",
        "questions": [
            {"q": "Co pierwsze zwróciło twoją uwagę u drugiej osoby?", "options": ["Uśmiech", "Oczy", "Poczucie humoru", "Rozmowa"]},
            {"q": "Nasza najlepsza wspólna chwila to…", "options": ["Jakiś wyjazd", "Zwykły wieczór w domu", "Ważna rozmowa", "Szalony spontan"]},
            {"q": "Kto pierwszy napisał lub zagadał?", "options": ["Ja", "Druga osoba", "Nie pamiętamy / kłócimy się o to"]},
            {"q": "Pierwsza randka była…", "options": ["Idealna", "Stresująca, ale urocza", "Zabawna katastrofa", "Nie było klasycznej randki"]},
            {"q": "Nasza piosenka / film to…", "options": ["Mamy jedną konkretną", "Mamy kilka", "Jeszcze nie mamy — czas wybrać!"]},
        ],
    },
    {
        "topic": "Komunikacja",
        "emoji": "💬",
        "questions": [
            {"q": "Po kłótni potrzebuję…", "options": ["Od razu porozmawiać", "Chwili ciszy", "Przytulenia", "Spaceru, żeby ochłonąć"]},
            {"q": "Gdy mam gorszy dzień, najbardziej pomaga mi…", "options": ["Wysłuchanie bez rad", "Konkretna pomoc", "Rozśmieszenie", "Trochę przestrzeni"]},
            {"q": "Wiadomości w ciągu dnia", "options": ["Piszemy cały dzień", "Kilka razy dziennie", "Głównie w ważnych sprawach"]},
            {"q": "Komplementy wolę…", "options": ["Na głos, przy innych", "Na osobności", "Na piśmie"]},
            {"q": "Trudne tematy omawiamy…", "options": ["Twarzą w twarz", "Na spacerze", "Najpierw na piśmie", "Odkładamy na potem 🙈"]},
        ],
    },
    {
        "topic": "Zdrowie i dbanie o siebie",
        "emoji": "🌿",
        "questions": [
            {"q": "Ulubiona wspólna aktywność", "options": ["Spacer", "Rower", "Siłownia lub fitness", "Joga lub stretching"]},
            {"q": "Jak najlepiej się regenerujesz?", "options": ["Sen", "Ruch", "Czas z bliskimi", "Czas w samotności"]},
            {"q": "Kawa czy herbata?", "options": ["Kawa", "Herbata", "Kakao albo coś innego"]},
            {"q": "Masaż — kto komu częściej?", "options": ["Ja tobie", "Ty mnie", "Po równo", "Za rzadko! 😄"]},
            {"q": "Gdy któreś z was choruje…", "options": ["Opiekujemy się jak w szpitalu", "Każdy kuruje się sam", "Rosół i serial razem"]},
        ],
    },
    {
        "topic": "Bliskość",
        "emoji": "🫶",
        "questions": [
            {"q": "Najlepsza forma czułości na co dzień", "options": ["Przytulanie", "Trzymanie za rękę", "Pocałunek na powitanie", "Miłe słowo"]},
            {"q": "Zasypiamy…", "options": ["Wtuleni", "Każdy na swojej połowie", "Zaczynamy wtuleni, kończymy osobno"]},
            {"q": "Randka w domu czy na mieście?", "options": ["W domu", "Na mieście", "Zależy od nastroju"]},
            {"q": "Ile czasu tylko dla siebie potrzebujesz w tygodniu?", "options": ["Prawie wcale", "Jeden wieczór", "Kilka godzin codziennie"]},
            {"q": "Najbardziej doceniam, gdy druga osoba…", "options": ["Pamięta o drobiazgach", "Planuje niespodzianki", "Słucha uważnie", "Odciąża mnie w obowiązkach"]},
        ],
    },
    {
        "topic": "Pieniądze i plany",
        "emoji": "💰",
        "questions": [
            {"q": "Premia wpada na konto. Co robisz?", "options": ["Oszczędzam", "Wydaję na przyjemności", "Wspólny wyjazd", "Inwestuję"]},
            {"q": "Prezenty — wolisz…", "options": ["Niespodziankę", "Coś z listy życzeń", "Przeżycie zamiast rzeczy"]},
            {"q": "Większe zakupy planujemy…", "options": ["Długo i z tabelką", "Szybko, gdy się podoba", "Zależy kto kupuje 😉"]},
            {"q": "Budżet na randkę", "options": ["Im taniej, tym kreatywniej", "Raz na jakiś czas szalejemy", "Nie liczymy"]},
            {"q": "Wspólny cel na ten rok", "options": ["Oszczędności", "Podróż", "Remont lub przeprowadzka", "Więcej czasu razem"]},
        ],
    },
    {
        "topic": "Gdybyśmy…",
        "emoji": "🎲",
        "questions": [
            {"q": "Gdybyśmy wygrali milion, najpierw…", "options": ["Dom", "Podróż dookoła świata", "Pomagamy rodzinie", "Rzucamy pracę"]},
            {"q": "Gdybyśmy mieli supermoc", "options": ["Teleportacja", "Czytanie w myślach", "Zatrzymywanie czasu", "Latanie"]},
            {"q": "Gdybyśmy razem otworzyli biznes", "options": ["Kawiarnia", "Pensjonat", "Sklep internetowy", "Nigdy razem! 😅"]},
            {"q": "Gdybyśmy mieli tydzień wolnego od jutra", "options": ["Wylot gdziekolwiek", "Wyspanie się w domu", "Wyjazd do rodziny", "Remont, w końcu"]},
            {"q": "Gdyby nasz związek był filmem, byłby to…", "options": ["Komedia romantyczna", "Film przygodowy", "Sitcom", "Romantyczny dramat"]},
        ],
    },
]


def quiz_for(day):
    """Quiz na dany dzień (date) — codziennie inny temat."""
    t = QUIZ_TOPICS[day.toordinal() % len(QUIZ_TOPICS)]
    return {
        "date": day.isoformat(),
        "topic": t["topic"],
        "emoji": t["emoji"],
        "questions": t["questions"],
    }


def valid_answers(quiz, answers):
    qs = quiz["questions"]
    if not isinstance(answers, list) or len(answers) != len(qs):
        return False
    for a, q in zip(answers, qs):
        if not isinstance(a, int) or isinstance(a, bool) or not 0 <= a < len(q["options"]):
            return False
    return True


def quiz_summary(quiz, her, partner):
    """Podsumowanie: ile odpowiedzi zgodnych + lista pytań z oboma odpowiedziami."""
    items = []
    matches = 0
    for i, q in enumerate(quiz["questions"]):
        same = her[i] == partner[i]
        matches += 1 if same else 0
        items.append({
            "q": q["q"],
            "her": q["options"][her[i]],
            "partner": q["options"][partner[i]],
            "match": same,
        })
    total = len(items)
    pct = round(matches * 100 / total) if total else 0
    if pct == 100:
        verdict = "Pełna zgodność! Czytacie sobie w myślach 💞"
    elif pct >= 80:
        verdict = "Prawie jak jedna osoba — świetnie się znacie."
    elif pct >= 60:
        verdict = "Sporo wspólnego, a różnice tylko dodają smaku."
    elif pct >= 40:
        verdict = "Pół na pół — dobry pretekst do rozmowy przy kolacji."
    else:
        verdict = "Przeciwieństwa się przyciągają! Porozmawiajcie o różnicach — może być zabawnie."
    return {"matches": matches, "total": total, "percent": pct, "verdict": verdict, "items": items}


# ---------- Pomysły na randkę ----------
# mood: "cozy" (spokojnie, w domu), "active" (ruch, wyjście), "out" (na mieście)

DATE_IDEAS = [
    {"emoji": "🎬", "title": "Kino w domu", "text": "Koc, popcorn, zgaszone światło i film, który wybiera ona.", "mood": "cozy", "cost": "0 zł"},
    {"emoji": "🍝", "title": "Wspólne gotowanie", "text": "Wybierzcie przepis z kuchni, której jeszcze nie znacie, i gotujcie razem.", "mood": "cozy", "cost": "$"},
    {"emoji": "🧖", "title": "Domowe spa", "text": "Maseczki, ciepła kąpiel, olejek do masażu i spokojna muzyka.", "mood": "cozy", "cost": "$"},
    {"emoji": "🧩", "title": "Wieczór planszówek", "text": "Gra kooperacyjna albo puzzle przy herbacie — bez telefonów.", "mood": "cozy", "cost": "0 zł"},
    {"emoji": "🍫", "title": "Degustacja słodkości", "text": "Kupcie 5 różnych czekolad lub ciastek i oceniajcie je w skali 1–10.", "mood": "cozy", "cost": "$"},
    {"emoji": "📚", "title": "Wieczór czytania", "text": "Każde ze swoją książką, wspólny koc i kakao. Cicha bliskość.", "mood": "cozy", "cost": "0 zł"},
    {"emoji": "🎨", "title": "Malujemy siebie nawzajem", "text": "Kartki, farby lub kredki i 15 minut na portret drugiej osoby. Śmiech gwarantowany.", "mood": "cozy", "cost": "$"},
    {"emoji": "🏕️", "title": "Biwak w salonie", "text": "Namiot z koców, lampki, przekąski i rozmowy do późna.", "mood": "cozy", "cost": "0 zł"},
    {"emoji": "📸", "title": "Album wspomnień", "text": "Przejrzyjcie wspólne zdjęcia i wybierzcie 10 do wydrukowania.", "mood": "cozy", "cost": "0 zł"},
    {"emoji": "🎤", "title": "Karaoke we dwoje", "text": "YouTube, szczotka zamiast mikrofonu i wasze ulubione hity.", "mood": "cozy", "cost": "0 zł"},
    {"emoji": "🍷", "title": "Kolacja przy świecach", "text": "Nawet zwykła pasta smakuje inaczej przy świecach i ładnym nakryciu.", "mood": "cozy", "cost": "$"},
    {"emoji": "💬", "title": "36 pytań", "text": "Zadajcie sobie słynne „36 pytań, które zbliżają” — znajdziecie je w sieci.", "mood": "cozy", "cost": "0 zł"},
    {"emoji": "🌅", "title": "Wschód lub zachód słońca", "text": "Termos z kawą, koc i miejsce z widokiem na horyzont.", "mood": "active", "cost": "0 zł"},
    {"emoji": "🚲", "title": "Wycieczka rowerowa", "text": "Wybierzcie trasę, której nie znacie, i zatrzymajcie się na lody.", "mood": "active", "cost": "0 zł"},
    {"emoji": "🥾", "title": "Spacer w nowe miejsce", "text": "Las, park albo dzielnica, w której jeszcze nie byliście.", "mood": "active", "cost": "0 zł"},
    {"emoji": "🧺", "title": "Piknik", "text": "Kanapki, owoce, koc i park. Zimą — piknik na podłodze w salonie.", "mood": "active", "cost": "$"},
    {"emoji": "⛸️", "title": "Łyżwy lub rolki", "text": "Trzymanie się za ręce ma tu bardzo praktyczne uzasadnienie 😄", "mood": "active", "cost": "$"},
    {"emoji": "🧗", "title": "Ścianka wspinaczkowa", "text": "Asekurujcie się nawzajem — świetne na zaufanie.", "mood": "active", "cost": "$$"},
    {"emoji": "💃", "title": "Lekcja tańca", "text": "Salsa, bachata albo tutorial w salonie.", "mood": "active", "cost": "$$"},
    {"emoji": "🔭", "title": "Oglądanie gwiazd", "text": "Wyjedźcie za miasto, gdzie jest ciemno, i poszukajcie gwiazdozbiorów w aplikacji.", "mood": "active", "cost": "0 zł"},
    {"emoji": "🎳", "title": "Kręgle lub bilard", "text": "Mała rywalizacja: przegrany stawia deser.", "mood": "out", "cost": "$$"},
    {"emoji": "☕", "title": "Kawiarniane safari", "text": "Odwiedźcie 2–3 nowe kawiarnie i wybierzcie ulubioną.", "mood": "out", "cost": "$"},
    {"emoji": "🖼️", "title": "Muzeum lub wystawa", "text": "Wybierzcie po jednym ulubionym dziele i opowiedzcie, dlaczego.", "mood": "out", "cost": "$"},
    {"emoji": "🍜", "title": "Kuchnia świata", "text": "Restauracja z kuchnią, której żadne z was jeszcze nie próbowało.", "mood": "out", "cost": "$$"},
    {"emoji": "🎭", "title": "Stand-up lub teatr", "text": "Wspólny śmiech zbliża bardziej niż niejedna kolacja.", "mood": "out", "cost": "$$"},
    {"emoji": "🛍️", "title": "Prezent za 20 zł", "text": "Rozdzielcie się w galerii i kupcie sobie nawzajem prezent za max 20 zł.", "mood": "out", "cost": "$"},
    {"emoji": "🏺", "title": "Warsztaty ceramiki", "text": "Ulepcie sobie nawzajem kubki — zostanie pamiątka.", "mood": "out", "cost": "$$"},
    {"emoji": "🎡", "title": "Mini wycieczka", "text": "Pociąg do najbliższego miasteczka i dzień bez planu.", "mood": "active", "cost": "$$"},
]

# w jakich fazach które nastroje randki pasują najlepiej
_PHASE_MOODS = {
    "Okres": ["cozy"],
    "Przerwa": ["cozy"],
    "Faza lutealna": ["cozy", "out"],
    "Faza folikularna": ["active", "out"],
    "Dni płodne": ["out", "active"],
    "Owulacja": ["out", "active"],
}


def date_ideas(day, phase=None, seed=0):
    """Wszystkie pomysły w kolejności na dziś: najpierw pasujące do fazy cyklu,
    w każdej grupie losowo (ale stała kolejność przez cały dzień)."""
    rnd = random.Random(day.toordinal() * 7919 + seed)
    ideas = DATE_IDEAS[:]
    rnd.shuffle(ideas)
    pref = _PHASE_MOODS.get(phase or "", [])

    def rank(idea):
        return pref.index(idea["mood"]) if idea["mood"] in pref else len(pref)

    ideas.sort(key=rank)
    out = []
    for idea in ideas:
        item = dict(idea)
        item["fits"] = idea["mood"] in pref[:1]
        out.append(item)
    return out


# ---------- Jak poprawić jej dzień (podpowiedzi dla partnera) ----------

_SYMPTOM_TIPS = {
    "Ból brzucha": ("🔥", "Termofor i ciepło", "Przygotuj termofor albo ciepły koc — ciepło rozluźnia skurcze."),
    "Ból pleców": ("💆", "Masaż pleców", "Delikatny masaż dolnej części pleców potrafi zdziałać cuda."),
    "Ból głowy": ("🌙", "Cisza i ciemność", "Przygaś światło, ścisz telewizor i podaj szklankę wody."),
    "Ból piersi": ("🤍", "Delikatność", "Piersi mogą być tkliwe — przytulaj ostrożnie i nie żartuj z tego."),
    "Opuchnięte piersi": ("🤍", "Delikatność", "Piersi mogą być tkliwe — przytulaj ostrożnie."),
    "Ból jajników": ("🛋️", "Spokojny wieczór", "Zaproponuj kanapę i film zamiast wyjścia — odpoczynek pomaga."),
    "Wzdęcia": ("🍵", "Ciepła herbata", "Mięta albo imbir na wzdęcia i luźny dres zamiast eleganckiego wyjścia."),
    "Mdłości": ("🫚", "Imbir i lekko", "Herbata z imbirem, sucharki — i nic ciężkiego na kolację."),
    "Zgaga": ("🥣", "Lekka kolacja", "Lekkostrawna kolacja i bez pikantnych potraw."),
    "Zachcianki na słodkie": ("🍫", "Coś słodkiego", "Kup jej ulubioną czekoladę albo deser — bez komentarzy 😉"),
    "Zwiększony apetyt": ("🍕", "Ulubione jedzenie", "Zamów albo ugotuj jej ulubione danie."),
    "Brak apetytu": ("🍲", "Coś lekkiego", "Zupa krem albo owoce — małe porcje, bez namawiania."),
    "Trudności z koncentracją": ("📝", "Odciąż w sprawach", "Weź na siebie załatwianie spraw i pamiętanie o terminach."),
    "Niepokój": ("🫂", "Spokojna obecność", "Bądź blisko, wysłuchaj bez dawania rad i przypomnij, że jesteś."),
    "Płaczliwość": ("🫂", "Przytul bez pytań", "Emocje mogą być silniejsze — przytulenie zamiast „uspokój się”."),
    "Bóle mięśni": ("🛁", "Ciepła kąpiel", "Przygotuj jej ciepłą kąpiel z solą."),
    "Kurcze nóg": ("🦵", "Masaż łydek", "Masaż łydek i stóp + woda z magnezem."),
    "Zawroty głowy": ("🥤", "Woda i odpoczynek", "Pilnuj, żeby piła wodę i nie dźwigała zakupów."),
    "Trądzik": ("💗", "Komplement", "Powiedz jej, że wygląda pięknie — szczególnie dziś to ważne."),
    "Wrażliwość na światło": ("🕯️", "Przygaszone światło", "Lampki zamiast górnego światła i mniej ekranów."),
}

_MOOD_TIPS = {
    "smutna": ("💐", "Mały gest", "Kwiatek, liścik albo ulubiona przekąska — drobiazg, który pokaże, że myślisz."),
    "zła": ("🧘", "Cierpliwość", "Nie bierz drażliwości do siebie. Daj przestrzeń i zaproponuj pomoc."),
    "drażliwa": ("🧘", "Cierpliwość", "Nie bierz drażliwości do siebie. Mniej pytań, więcej konkretnej pomocy."),
    "lękowa": ("🫂", "Poczucie bezpieczeństwa", "Spokojny ton, przytulenie i zapewnienie, że wszystko ogarniecie razem."),
    "spięta": ("💆", "Masaż karku", "Kilka minut masażu karku i ramion rozładuje napięcie."),
    "płaczliwa": ("🫂", "Przytul bez pytań", "Nie musisz niczego naprawiać — wystarczy, że jesteś obok."),
    "bezsilna": ("🧺", "Przejmij obowiązki", "Zrób dziś obiad, zakupy albo pranie bez proszenia."),
    "zmęczona": ("😴", "Daj jej odpocząć", "Przejmij wieczorne obowiązki i pozwól jej wcześniej się położyć."),
    "przygnębiona": ("💐", "Mały gest", "Kwiatek, liścik albo ulubiona przekąska — drobiazg, który pokaże, że myślisz."),
    "znudzona": ("🎲", "Coś nowego", "Zaproponuj coś spontanicznego — nowe miejsce, gra, wspólne gotowanie."),
    "radosna": ("🎉", "Świętujcie", "Ma dobry dzień — zaproponuj wspólne wyjście albo coś spontanicznego!"),
    "pobudzona": ("🎉", "Świętujcie", "Ma dużo energii — zaproponuj wspólne wyjście albo coś spontanicznego!"),
    "towarzyska": ("🥂", "Spotkanie ze znajomymi", "Dobry dzień, żeby zaprosić znajomych albo gdzieś razem wyjść."),
    "energiczna": ("🚲", "Aktywnie razem", "Dobry moment na rower, spacer albo nowe miejsce."),
    "zakochana": ("💌", "Czułość", "Odwzajemnij — liścik, długi pocałunek albo randka wieczorem."),
}

_PHASE_TIPS = {
    "Okres": [
        ("🔥", "Ciepło", "Termofor, kocyk i ciepła herbata to podstawowy zestaw na okres."),
        ("🧺", "Mniej obowiązków", "Weź na siebie dzisiejsze sprzątanie i zakupy."),
        ("🛒", "Zapas w łazience", "Zapytaj, czy kupić podpaski, tampony albo tabletki przeciwbólowe."),
    ],
    "Przerwa": [
        ("🔥", "Ciepło", "W przerwie w tabletkach zwykle jest krwawienie — termofor i herbata się przydadzą."),
        ("🧺", "Mniej obowiązków", "Odciąż ją dziś w domowych sprawach."),
    ],
    "Faza folikularna": [
        ("🌿", "Nowe rzeczy", "Rośnie energia — zaproponuj coś nowego: miejsce, sport, wycieczkę."),
        ("💬", "Plany razem", "Dobry czas na rozmowy o planach i marzeniach."),
    ],
    "Dni płodne": [
        ("💌", "Flirt", "Często rośnie ochota na bliskość — komplement i flirt będą mile widziane."),
        ("✨", "Randka", "Dobry moment na wyjście na miasto we dwoje."),
    ],
    "Owulacja": [
        ("💌", "Flirt", "Szczyt energii i dobrego nastroju — zaplanuj coś wyjątkowego."),
        ("✨", "Randka", "Dobry moment na wyjście na miasto we dwoje."),
    ],
    "Faza lutealna": [
        ("🍫", "Coś słodkiego", "Przed okresem rośnie ochota na słodkie — mała niespodzianka ucieszy."),
        ("🧘", "Cierpliwość", "Może być bardziej drażliwa lub zmęczona — więcej wyrozumiałości."),
        ("🫂", "Przytulenie", "Drobne gesty czułości robią teraz dużą różnicę."),
    ],
}

_DEFAULT_TIPS = [
    ("💬", "Zapytaj", "Zapytaj, jak się dziś czuje i czego potrzebuje — i naprawdę posłuchaj."),
    ("☕", "Mała niespodzianka", "Kawa do łóżka albo ulubiona przekąska — drobiazgi cieszą najbardziej."),
]


def support_tips(phase, logged_symptoms=(), logged_moods=(), predicted_symptoms=(), limit=6):
    """Konkretne podpowiedzi dla partnera. Kolejność: to, co dziś wpisała,
    potem to, co zwykle notuje w tej fazie, potem ogólne dla fazy."""
    out, seen = [], set()

    def add(tip, source):
        emoji, title, text = tip
        if title in seen:
            return
        seen.add(title)
        out.append({"emoji": emoji, "title": title, "text": text, "source": source})

    for m in logged_moods:
        t = _MOOD_TIPS.get((m or "").lower())
        if t:
            add(t, "today")
    for s in logged_symptoms:
        t = _SYMPTOM_TIPS.get(s)
        if t:
            add(t, "today")
    for s in predicted_symptoms:
        t = _SYMPTOM_TIPS.get(s)
        if t:
            add(t, "usual")
    for t in _PHASE_TIPS.get(phase or "", []):
        add(t, "phase")
    for t in _DEFAULT_TIPS:
        add(t, "phase")
    return out[:limit]


# ---------- „Czego dziś potrzebuję” (ona ustawia, partner widzi) ----------

NEEDS = [
    {"key": "hug", "emoji": "🤗", "label": "Przytulenia"},
    {"key": "sweet", "emoji": "🍫", "label": "Czegoś słodkiego"},
    {"key": "quiet", "emoji": "🤫", "label": "Spokoju i ciszy"},
    {"key": "help", "emoji": "🧺", "label": "Pomocy w obowiązkach"},
    {"key": "warm", "emoji": "🔥", "label": "Termoforu i herbaty"},
    {"key": "talk", "emoji": "💬", "label": "Rozmowy"},
    {"key": "massage", "emoji": "💆", "label": "Masażu"},
    {"key": "movie", "emoji": "🎬", "label": "Wieczoru z filmem"},
    {"key": "out", "emoji": "🌿", "label": "Wyjścia z domu"},
    {"key": "space", "emoji": "🫧", "label": "Czasu dla siebie"},
    {"key": "shop", "emoji": "🛒", "label": "Zakupów (podpaski, leki)"},
    {"key": "date", "emoji": "💃", "label": "Randki"},
]
NEED_KEYS = {n["key"] for n in NEEDS}


def needs_payload(keys):
    by = {n["key"]: n for n in NEEDS}
    return [by[k] for k in keys if k in by]
