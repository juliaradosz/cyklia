# -*- coding: utf-8 -*-
"""
Asystent cyklu Cyklia.

Domyślnie działa w 100% lokalnie — odpowiada na bazie reguł (nie jest to
prawdziwa sztuczna inteligencja, więc nie zna odpowiedzi na każde pytanie).

Aby włączyć prawdziwe AI, ustaw zmienne środowiskowe:
    CYKLIA_LLM_API   – dowolny endpoint OpenAI-compatible,
                       np. https://api.groq.com/openai/v1/chat/completions (darmowy)
    CYKLIA_LLM_KEY   – Twój klucz API
    CYKLIA_LLM_MODEL – opcjonalnie nazwa modelu
                       (Groq: np. llama-3.3-70b-versatile)
Gdy są ustawione, asystent używa modelu i odpowiada na dowolne pytania.
Bez klucza odpowiada lokalnie na tematach, które zna.
"""
import os
import urllib.request
import json


def _pick(topics, user_message):
    msg = user_message.lower()
    return any(t in msg for t in topics)


def _date_text(iso_date):
    from datetime import datetime

    days = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"]
    months = [
        "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
        "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
    ]
    d = datetime.strptime(iso_date, "%Y-%m-%d")
    return f"{days[d.weekday()]}, {d.day} {months[d.month - 1]}"


def _personal_reply(message, ctx):
    """Odpowiedzi oparte o kalendarz użytkownika (ctx). Zwraca None, jeśli pytanie nie pasuje."""
    if not ctx:
        return None
    msg = message.lower()

    # Pytanie o termin / liczbę dni — tylko wtedy używamy dat z kalendarza.
    # Dzięki temu pytanie "Jak długo trwa okres?" NIE zwróci przewidywanej daty.
    asking_when = any(
        k in msg
        for k in [
            "kiedy", "za ile", "ile dni", "ile do", "ile zostało", "ile zostalo",
            "czy blisko", "czy jutro", "czy już", "czy juz", "kiedy przyjdzie",
            "kiedy bedzie", "kiedy będzie", "kiedy dostane", "kiedy dostanę",
            "dostanę", "dostane", "kiedy się zacznie", "kiedy sie zacznie",
            "jaki dzień", "jaki dzien", "który dzień", "ktory dzien", "jak duzo",
            "jak dużo", "za ile dni",
        ]
    )

    # Owulacja / dni płodne — sam temat oznacza intencję.
    # Pytania typu "co to jest owulacja?" to definicje — zostaw je regułom wiedzy.
    asking_definition = any(k in msg for k in ["co to", "czym jest", "czym jest", "definicj", "co oznacza"])
    if not asking_definition and ("owulacj" in msg or "dni płodn" in msg or "dni plodn" in msg):
        if ctx.get("on_pills"):
            return (
                "Stosujesz tabletki antykoncepcyjne, więc owulacja i dni płodne "
                "nie występują — hormonoterapia je blokuje. Nie musisz śledzić "
                "okna płodności. Pamiętaj tylko o regularnym przyjmowaniu tabletek."
            )
        if ctx.get("ovulation_date"):
            ov = _date_text(ctx["ovulation_date"])
            if ctx.get("fertile_start") and ctx.get("fertile_end"):
                fs = _date_text(ctx["fertile_start"])
                fe = _date_text(ctx["fertile_end"])
                return (
                    f"Na podstawie Twojego kalendarza: owulacja wypada {ov}. "
                    f"Dni płodne to {fs} – {fe} (5 dni przed owulacją + 1 po). "
                    "To oszacowanie — obserwuj też śluz i temperaturę."
                )
            return f"Na podstawie Twojego kalendarza owulacja wypada {ov}."

    # Kiedy przyjdzie okres / za ile dni.
    if "okres" in msg or "miesiączk" in msg or "miesiaczk" in msg or "period" in msg:
        if asking_when and ctx.get("next_period_start"):
            nxt = _date_text(ctx["next_period_start"])
            days = ctx.get("days_to_period")
            if days == 1:
                return (
                    f"Na podstawie Twojego kalendarza kolejny okres przewiduję na {nxt} "
                    "— to jutro!"
                )
            if days is not None and days >= 0:
                return (
                    f"Na podstawie Twojego kalendarza kolejny okres przewiduję na "
                    f"{nxt} — to za {days} dni."
                )
            return f"Na podstawie Twojego kalendarza kolejny okres przewiduję na {nxt}."
        if "ile dni" in msg and "do" in msg and ctx.get("days_to_period") is not None:
            return f"Do kolejnego okresu zostało {ctx['days_to_period']} dni."

    # Jaki dzień cyklu.
    if ("cyklu" in msg and ("dzień" in msg or "dzien" in msg)) or any(
        k in msg for k in ["który dzień", "ktory dzien", "jaki dzien", "jaki dzień"]
    ):
        if ctx.get("cycle_day"):
            return f"Dziś jest {ctx['cycle_day']}. dzień Twojego cyklu."

    if any(k in msg for k in ["ile dni do", "za ile", "ile do"]):
        if ctx.get("days_to_period") is not None:
            return f"Do kolejnego okresu zostało {ctx['days_to_period']} dni."

    return None


# ---------------------------------------------------------------------------
# Odpowiedzi "wiedza" (lokalne, bez AI)
# ---------------------------------------------------------------------------

def _knowledge_reply(message):
    msg = message.lower()

    if _pick(["owulacj", "dni płodn", "dni plodn", "jajeczk"], msg):
        return (
            "Owulacja to moment, w którym jajeczkowanie ma miejsce — zwykle ok. 14 dni "
            "przed końcem cyklu (mniej więcej w połowie). Dni płodne zaczynają się około "
            "5 dni przed owulacją i trwają do ok. doby po niej. Obserwuj śluz szyjkowy "
            "i temperaturę, a w Kalendarzu zobaczysz prognozę na swoje konkretne daty. "
            "Pamiętaj, że to oszacowanie — cykl bywa różny."
        )

    if _pick(["ile trwa", "jak długo", "jak dlugo"], msg) and _pick(
        ["okres", "miesiączk", "miesiaczk"], msg
    ):
        return (
            "Miesiączka zwykle trwa od 3 do 7 dni. Krew może być na początku obfitsza, "
            "pod koniec skąpsza. Jeśli okres trwa ponad 7-8 dni albo jest wyjątkowo "
            "obfity, warto porozmawiać z ginekologiem."
        )

    if _pick(["nieregularn", "nie regularn", "nie wiem kiedy", "nie wiem, kiedy"], msg) or _pick(
        ["spóźnia", "spoznia", "opoznia", "opóźnia"], msg
    ):
        return (
            "Nieregularne cykle są częste, zwłaszcza przy stresie, zmianie trybu życia czy "
            "hormonach. Nasz kalendarz sam liczy Twoją średnią długość cyklu z historii — "
            "im więcej wpisów, tym trafniejsza prognoza. Jeśli cykl robi się bardzo "
            "nieregularny (różnice powyżej 7-9 dni) lub znika na kilka miesięcy, warto "
            "skonsultować się z ginekologiem."
        )

    if _pick(["pms", "zespół napięcia", "zespol napiecia", "drażliw", "drazliw", "wzrusz"], msg):
        return (
            "PMS (zespół napięcia przedmiesiączkowego) zwykle pojawia się w drugiej fazie "
            "cyklu. Pomagają: regularny ruch, sen 7-8h, ograniczenie kawy i soli, "
            "suplementacja magnezu i witaminy B6. Prowadź dziennik objawów w aplikacji — "
            "zobaczysz, czy objawy wracają cyklicznie. Jeśli ból lub wahania nastroju "
            "utrudniają codzienne życie, porozmawiaj z lekarzem."
        )

    if _pick(["bolesn", "boly", "bóle", "skurcz", "boli", "brzuch"], msg) or _pick(
        ["bol", "ból"], msg
    ):
        if "jajnik" in msg or "owulacyjn" in msg or "pośrodku" in msg or "posrodku" in msg:
            return (
                "Ból owulacyjny (mittelschmerz) to krótki, kłujący ból w podbrzuszu "
                "pośrodku cyklu, gdy jajeczko zostaje uwolnione. Zwykle trwa od kilku "
                "minut do 1-2 dni i jest niegroźny. Jeśli ból jest silny, długi albo "
                "powtarza się co cykl, sprawdź to u lekarza."
            )
        return (
            "Bóle miesiączkowe (skurcze macicy) są bardzo częste. Ulgę przynoszą: ciepły "
            "okład na podbrzusze, lekki ruch, herbata z rumianku lub imbiru, a w razie "
            "potrzeby ibuprofen (po konsultacji z lekarzem). Silny, nawracający ból może "
            "wskazywać na endometriozę — warto to sprawdzić u ginekologa. Zaznaczaj ból w "
            "dzienniku, by widzieć powiązania."
        )

    if _pick(["temperatur", "termometr"], msg):
        return (
            "Pomiar temperatury bazowej (na czczo, rano, zanim wstaniesz z łóżka) pomaga "
            "potwierdzić owulację — po niej temperatura rośnie o ok. 0,2-0,5°C i utrzymuje "
            "się do końca cyklu. Wprowadzaj ją codziennie w dzienniku, a nasze statystyki "
            "pokażą Ci wzorce. Najlepiej mierzyć zawsze o podobnej porze. Uwaga: przy "
            "tabletkach antykoncepcyjnych pomiar temperatury nie ma sensu, bo owulacji nie ma."
        )

    if _pick(["śluz", "sluz"], msg):
        return (
            "Śluz szyjkowy zmienia się w trakcie cyklu: po okresie jest skąpy i gęsty, "
            "w okolicy owulacji staje się przezroczysty, śliski i rozciągliwy (jak białko "
            "jajka). To jeden z naturalnych sygnałów płodności. Wpisuj go w Dzienniku, "
            "a kalendarz pokaże, czy Twój wzorzec pokrywa się z prognozą owulacji."
        )

    if _pick(["śpi", "sen", "zmęczon", "zmeczon", "zmęczenie", "zmeczenie"], msg):
        return (
            "Sen w ciągu cyklu naprawdę bywa różny: w drugiej fazie wiele z nas śpi gorzej "
            "przez wzrost progesteronu. Postaraj się: kłaść o stałej porze, unikać kofeiny "
            "po południu, wietrzyć sypialnię. Zapisz godziny snu w dzienniku, by sprawdzić, "
            "czy Twoje zmęczenie ma związek z fazą cyklu."
        )

    if _pick(["zdrowi", "witamin", "magnez", "żelaz", "zelaz", "suplement", "mikroelement"], msg):
        return (
            "W pierwszej fazie cyklu pomocne jest żelazo (zwłaszcza przy obfitych "
            "okresach), w drugiej fazie magnez i witamina B6 łagodzą PMS, a wapń i "
            "witamina D wspierają ogólną równowagę hormonalną. Suplementy warto dobierać "
            "z lekarzem lub dietetykiem — a zrównoważona dieta bogata w białko, zdrowe "
            "tłuszcze i warzywa to podstawa. To ogólne wskazówki, nie porada medyczna."
        )

    if _pick(["ciąż", "ciaza", "staram", "staramy", "test ciążowy", "test ciazowy"], msg):
        return (
            "Kiedy staracie się o dziecko, kluczowe jest trafienie w dni płodne. Nasz "
            "kalendarz pokazuje prognozę owulacji i okno płodności. Warto dodatkowo "
            "obserwować śluz i mierzyć temperaturę. Test ciążowy najlepiej zrobić nie "
            "wcześniej niż w dniu spodziewanej miesiączki (lub 12-14 dni po owulacji). "
            "Pamiętaj: to aplikacja wspierająca, a nie metoda antykoncepcji. W razie "
            "wątpliwości skonsultuj się z lekarzem."
        )

    if _pick(["antykoncep", "zapobieg", "współżyc", "wspozyc", "prezerwatyw"], msg):
        return (
            "Ważna informacja: kalendarzowa metoda obserwacji cyklu NIE jest pewną "
            "antykoncepcją, nawet przy regularnych cyklach. Jeśli chcesz skutecznie "
            "zapobiegać ciąży, porozmawiaj z ginekologiem o bezpiecznych metodach "
            "(wkładka, tabletki, prezerwatywy itp.)."
        )

    if _pick(["tabletk", "pigułk", "pigulk", "antykoncepcję", "antykoncepcje"], msg):
        return (
            "Przy tabletkach antykoncepcyjnych organizm nie owuluje, więc kalendarz "
            "nie pokazuje dni płodnych ani owulacji — a kolejny okres przewiduje w "
            "przerwie między blistrami. Ustaw swój środek w Profilu → Antykoncepcja, "
            "a aplikacja dopasuje prognozy. Tabletki należy przyjmować regularnie "
            "o podobnej porze; nie pomijaj ich."
        )

    if _pick(["pominęła", "pominela", "zapomnia", "opuściła", "opuscila"], msg) or _pick(
        ["tabletka", "tabletkę", "tabletke"], msg
    ):
        return (
            "Jeśli chodzi o pominięte tabletki antykoncepcyjne lub ryzyko ciąży — to "
            "sytuacja, w której najlepiej skontaktować się z lekarzem lub farmaceutą "
            "albo zastosować antykoncepcję awaryjną tak szybko, jak to możliwe. Jestem "
            "aplikacją, nie lekarzem, ale jestem tu, żeby Cię wesprzeć. 💛"
        )

    if _pick(["plamieni", "rozmaz", "kropelkowe", "brązow", "brazow"], msg):
        return (
            "Plamienia między okresami bywają normalne — zwłaszcza lekkie, brązowe "
            "plamienie w okolicy owulacji lub tuż przed okresem. Uporczywe plamienia, "
            "zwłaszcza przy tabletkach lub po współżyciu, warto skonsultować z lekarzem. "
            "Zaznacz je w dzienniku, by widzieć, jak często się pojawiają."
        )

    if _pick(["hormon", "estrogen", "progesteron", "tarczyc", "androgen"], msg):
        return (
            "Za cykl odpowiadają przede wszystkim estrogen (pierwsza faza) i progesteron "
            "(druga faza). Ich wahania wpływają na nastrój, skórę, sen i apetyt. Jeśli "
            "odczuwasz silne zaburzenia — trądzik, nadmierne owłosienie, bardzo nieregularne "
            "cykle — lekarz może zlecić badania hormonalne, żeby wykluczyć np. PCOS "
            "lub problemy z tarczycą."
        )

    if _pick(["pcos", "policystyczn", "torbiel", "endometrioz"], msg):
        return (
            "PCOS (zespół policystycznych jajników) i endometrioza to częste przyczyny "
            "nieregularnych cykli, bólu i innych dolegliwości. Ich rozpoznanie stawia "
            "ginekolog na podstawie wywiadu, badań i USG. Prowadź dziennik objawów — "
            "to bardzo pomaga w diagnostyce. To treść edukacyjna, nie diagnoza: "
            "skonsultuj się z lekarzem."
        )

    if _pick(["skrzep", "obfity", "obfit"], msg):
        return (
            "Niewielkie skrzepy krwi podczas miesiączki są zwykle normalne. Jeśli krzepy "
            "są duże (np. większe niż moneta) albo okres jest wyjątkowo obfity i musisz "
            "zmieniać zabezpieczenie co godzinę lub dwie, warto to skonsultować z lekarzem."
        )

    if _pick(["suchość", "suchosc", "swędz", "swedz", "grzybic", "infekcj"], msg):
        return (
            "Suchość lub świąd okolic intymnych mogą wynikać z infekcji, zmian "
            "hormonalnych albo kosmetyków. Nie lecz się na własną rękę lekami "
            "przeciwgrzybicznymi na zapas — najlepiej, żeby zdiagnozował to "
            "ginekolog. Higiena: łagodne, bezzapachowe środki i oddychająca bielizna."
        )

    if _pick(["nastrój", "nastroj", "huśtaw", "hustaw", "smutek", "zdenerw"], msg):
        return (
            "Wahania nastroju przed okresem to skutek zmian hormonalnych (zwłaszcza "
            "progesteronu). Pomagają: sen, ruch na świeżym powietrzu, ograniczenie "
            "kofeiny i alkoholu oraz witamina B6. Jeśli nastroje są bardzo ciężkie "
            "i nie mijają po okresie, warto porozmawiać z lekarzem — to może być "
            "PMDD, które da się leczyć."
        )

    if _pick(["dziennik", "jak używać", "jak uzywac", "jak uzywać", "jak uzywac", "jak dodać", "jak dodac"], msg):
        return (
            "Zaznaczaj codziennie objawy, nastrój i temperaturę w zakładce Dziennik. "
            "Kiedy miesiączka się zacznie, dodaj nowy okres w kalendarzu. Im więcej danych, "
            "tym lepsze prognozy i statystyki. Wpisy możesz zawsze edytować — lista "
            "zapisanych dni jest na dole Dziennika."
        )

    if _pick(["statyst", "średni", "sredni", "ile trwa cykl"], msg):
        return (
            "W zakładce Statystyki zobaczysz: średnią długość cyklu, średnią długość "
            "okresu, regularność oraz wykresy temperatury i nastroju. Dane liczą się z "
            "wszystkich Twoich wpisów — im dłużej używasz aplikacji, tym są dokładniejsze."
        )

    if _pick(["dane", "prywatn", "bezpieczn", "kto widzi"], msg):
        return (
            "Twoje dane są widoczne tylko dla Ciebie. Logujesz się hasłem, a my nie "
            "udostępniamy niczego osobom trzecim. Twoje wpisy i kalendarz pozostają "
            "prywatne — nikt inny ich nie widzi."
        )

    if _pick(["kiedy zaczyna się okres", "kiedy sie zaczyna okres", "pierwszy okres", "dojrzewani"], msg):
        return (
            "Pierwsza miesiączka zwykle pojawia się między 11. a 15. rokiem życia, ale "
            "bywa wcześniej lub później — to zupełnie normalne. Przez pierwsze 1-2 lata "
            "cykle bywają nieregularne, bo organizm dopiero się uczy. Jeśli pierwsza "
            "miesiączka nie pojawi się do 16. roku życia, warto skonsultować się z lekarzem."
        )

    if _pick(["co to jest", "co umiesz", "co potrafi", "jak działasz", "jak dzialasz"], msg):
        return (
            "Jestem asystentem Cyklia. Odpowiadam na pytania o: owulację i dni płodne, "
            "PMS, bóle miesiączkowe, temperaturę bazową, śluz, sen, suplementy, "
            "tabletki antykoncepcyjne i zdrowy tryb życia. Uwzględniam też Twój "
            "kalendarz — podaję konkretne daty. Pamiętaj, że moje odpowiedzi są "
            "edukacyjne i nie zastępują wizyty u lekarza."
        )

    return None


def local_reply(message, context=None):
    msg = message.lower()
    greetings = ["cześć", "czesc", "hej", "dzien dobry", "dzień dobry", "hello", "siema", "dzienny"]
    thanks = ["dzięki", "dzieki", "dziękuję", "dziekuje", "thx", "thanks"]

    personal = _personal_reply(message, context)
    if personal:
        return personal

    knowledge = _knowledge_reply(message)
    if knowledge:
        return knowledge

    if _pick(greetings, msg):
        return (
            "Cześć! Jestem Twoim asystentem zdrowia. 🙂 Możesz mnie pytać o cykl, "
            "owulację, objawy PMS, temperaturę czy sen. Wiem też, co jest w Twoim "
            "kalendarzu — np. kiedy przewiduję kolejny okres. W czym pomogę?"
        )
    if _pick(thanks, msg):
        return "Cała przyjemność! 💛 Jeśli masz jeszcze pytania, jestem tutaj."

    return (
        "Hmm, jeszcze nie znam odpowiedzi na to pytanie (działam teraz na regułach, "
        "bez połączenia z AI). 🙂 Najchętniej odpowiadam na tematy: owulacja i dni "
        "płodne, PMS, bóle miesiączkowe, temperatura bazowa, śluz, sen, suplementy, "
        "tabletki antykoncepcyjne, nieregularne cykle, plamienia. Możesz też "
        "zapytać: Kiedy mam okres?, Kiedy mam owulację? albo Który to dzień "
        "mojego cyklu? A jeśli chcesz pełne AI — podpięcie darmowego klucza "
        "opisane jest w README aplikacji."
    )


def llm_reply(message, api_url, api_key, model, history, context=None):
    ctx_note = ""
    if context:
        ctx_note = (
            f"Kontekst użytkownika z aplikacji: {json.dumps(context, ensure_ascii=False)}. "
            "Jeśli pytanie dotyczy terminów (okres, owulacja itd.), użyj tych dat."
        )
    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Jesteś uprzejmym asystentem zdrowia kobiet i śledzenia cyklu "
                    "miesiączkowego (aplikacja Cyklia). Odpowiadaj po polsku, zwięźle, "
                    "życzliwie i empatycznie. To treści edukacyjne, nie diagnoza. "
                    f"Przy poważnych objawach doradzaj konsultację z lekarzem. {ctx_note}"
                ),
            },
            *history[-8:],
            {"role": "user", "content": message},
        ],
        "temperature": 0.6,
    }
    req = urllib.request.Request(
        api_url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + api_key,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"].strip()


def reply(message, history=None, context=None):
    history = history or []
    api_url = os.environ.get("CYKLIA_LLM_API")
    api_key = os.environ.get("CYKLIA_LLM_KEY")
    model = os.environ.get("CYKLIA_LLM_MODEL", "meta-llama/llama-3.3-70b-instruct")
    if api_url and api_key:
        try:
            return llm_reply(message, api_url, api_key, model, history, context)
        except Exception:
            return local_reply(message, context) + (
                "\n\n(Uwaga: połączenie z modelem AI chwilowo nie zadziałało, "
                "więc odpowiadam lokalnie.)"
            )
    return local_reply(message, context)
