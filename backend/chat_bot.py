# -*- coding: utf-8 -*-
"""
Darmowy asystent cyklu. Działa w 100% lokalnie (bez płatnych API).
Jeśli ustawisz zmienną środowiskową CYKLIA_LLM_API (dowolny endpoint
OpenAI-compatible, np. darmowy model na OpenRouter/Groq), asystent
użyje modelu. Bez klucza odpowiada inteligentnie na bazie reguł.
"""
import os
import re
import urllib.request
import json


def _pick(topics, user_message):
    msg = user_message.lower()
    return any(t in msg for t in topics)


def local_reply(message):
    msg = message.lower()
    greetings = ["cześć", "czesc", "hej", "dzien dobry", "dzień dobry", "hello", "siema"]
    thanks = ["dzięki", "dzieki", "dziękuję", "dziekuje", "thx", "thanks"]

    if _pick(greetings, msg):
        return ("Cześć! Jestem Twoim asystentem zdrowia. 🙂 Możesz mnie pytać o cykl, "
                "owulację, objawy PMS, temperaturę czy sen. W czym pomogę?")
    if _pick(thanks, msg):
        return "Cała przyjemność! 💛 Jeśli masz jeszcze pytania, jestem tutaj."

    if _pick(["owulacj", "płodn", "plodn", "kiedy jajeczk"], msg) or _pick(["dzień płodny"], msg):
        return ("Owulacja to moment, w którym jajeczkowanie ma miejsce — zwykle ok. 14 dni "
                "przed końcem cyklu (mniej więcej w połowie). Dni płodne zaczynają się około "
                "5 dni przed owulacją i trwają do ok. doby po niej. Obserwuj śluz szyjkowy, "
                "temperaturę ciała i użyj naszego kalendarza, by zobaczyć prognozę na Twoje "
                "konkretne daty. Pamiętaj, że to oszacowanie — cykl bywa różny.")

    if _pick(["nieregularn", "nie regularn", "nie wiem kiedy", "nie wiem, kiedy"], msg) or _pick(
        ["spóźnia", "opoznia", "opóźnia", "spoznia"], msg
    ):
        return ("Nieregularne cykle są częste, zwłaszcza przy stresie, zmianie trybu życia czy "
                "hormonach. Nasz kalendarz sam liczy Twoją średnią długość cyklu z historii — "
                "im więcej wpisów, tym trafniejsza prognoza. Jeśli cykl robi się bardzo "
                "nieregularny (różnice powyżej 7-9 dni) lub znika na kilka miesięcy, warto "
                "skonsultować się z ginekologiem.")

    if _pick(["pms", "zespół napięcia", "zespol napiecia", "napady", "drażliw", "drazliw", "wzrusz"], msg):
        return ("PMS (zespół napięcia przedmiesiączkowego) zwykle pojawia się w drugiej fazie "
                "cyklu. Pomagają: regularny ruch, sen 7-8h, ograniczenie kawy i soli, "
                "suplementacja magnezu i witaminy B6. Prowadź dziennik objawów w aplikacji — "
                "zobaczysz, czy objawy wracają cyklicznie. Jeśli ból lub wahania nastroju "
                "utrudniają codzienne życie, porozmawiaj z lekarzem.")

    if _pick(["skurcz", "bol", "ból", "bobol", "brzuch", "bobol"], msg) or _pick(["bóle miesiącz"], msg):
        return ("Bóle miesiączkowe (skurcze macicy) są bardzo częste. Ulgę przynoszą: ciepły "
                "okład na podbrzusze, lekki ruch, herbata z rumianku lub imbiru, a w razie "
                "potrzeby ibuprofen (po konsultacji z lekarzem). Silny, nawracający ból może "
                "wskazywać na endometriozę — warto to sprawdzić u ginekologa. Zaznaczaj ból w "
                "dzienniku, by widzieć powiązania.")

    if _pick(["temperatur", "termometr"], msg):
        return ("Pomiar temperatury bazowej (na czczo, rano, zanim wstaniesz z łóżka) pomaga "
                "potwierdzić owulację — po niej temperatura rośnie o ok. 0,2-0,5°C i utrzymuje "
                "się do końca cyklu. Wprowadzaj ją codziennie w dzienniku, a nasze statystyki "
                "pokażą Ci wzorce. Najlepiej mierzyć zawsze o podobnej porze.")

    if _pick(["śpi", "sen", "zmęczon", "zmeczon", "zmęczenie"], msg) or _pick(["zmęczenie"], msg):
        return ("Sen w ciągu cyklu naprawdę bywa różny: w drugiej fazie wiele z nas śpi gorzej "
                "przez wzrost progesteronu. Postaraj się: kłaść o stałej porze, unikać kofeiny "
                "po południu, wietrzyć sypialnię. Zapisz godziny snu w dzienniku, by sprawdzić, "
                "czy Twoje zmęczenie ma związek z fazą cyklu.")

    if _pick(["zdrowi", "witamin", "magnez", "żelaz", "zelaz", "suplement"], msg):
        return ("W pierwszej fazie cyklu pomocne jest żelazo (zwłaszcza przy obfitych "
                "okresach), w drugiej fazie magnez i witamina B6 łagodzą PMS, a wapń i "
                "witamina D wspierają ogólną równowagę hormonalną. Suplementy warto dobierać "
                "z lekarzem lub dietetykiem — a zrównoważona dieta bogata w białko, zdrowe "
                "tłuszcze i warzywa to podstawa. To ogólne wskazówki, nie porada medyczna.")

    if _pick(["ciąż", "ciaza", "dziecko", "stara", "staramy"], msg):
        return ("Kiedy staracie się o dziecko, kluczowe jest trafienie w dni płodne. Nasz "
                "kalendarz pokazuje prognozę owulacji i okno płodności. Warto dodatkowo "
                "obserwować śluz i mierzyć temperaturę. Pamiętaj: to aplikacja wspierająca, "
                "a nie metoda antykoncepcji. W razie wątpliwości skonsultuj się z lekarzem.")

    if _pick(["antykoncep", "zapobieg", "współżyc", "wspożyc"], msg) or _pick(["współżycie"], msg):
        return ("Ważna informacja: kalendarzowa metoda obserwacji cyklu NIE jest pewną "
                "antykoncepcją, nawet przy regularnych cyklach. Jeśli chcesz skutecznie "
                "zapobiegać ciąży, porozmawiaj z ginekologiem o bezpiecznych metodach "
                "(wkładka, tabletki, prezerwatywy itp.).")

    if _pick(["wypadek", "zapomnia", "tabletka", "pominęła", "pominela", "opuściła", "opuscila"], msg):
        return ("Jeśli chodzi o pominięte tabletki antykoncepcyjne lub ryzyko ciąży — to "
                "sytuacja, w której najlepiej skontaktować się z lekarzem lub farmaceutą "
                "albo zastosować antykoncepcję awaryjną tak szybko, jak to możliwe. Jestem "
                "aplikacją, nie lekarzem, ale jestem tu, żeby Cię wesprzeć. 💛")

    if _pick(["dziennik", "objaw", "jak używac", "jak używac", "jak uzywać", "jak uzywać", "jak używac"], msg):
        return ("Zaznaczaj codziennie objawy, nastrój i temperaturę w zakładce Dziennik. "
                "Kiedy miesiączka się zacznie, dodaj nowy okres w kalendarzu. Im więcej danych, "
                "tym lepsze prognozy i statystyki. Spróbuj też zakładki Społeczność, by "
                "porozmawiać z innymi!")

    if _pick(["statyst", "średni", "sredni", "ile trwa"], msg):
        return ("W zakładce Statystyki zobaczysz: średnią długość cyklu, średnią długość "
                "okresu, regularność oraz wykresy temperatury i nastroju. Dane liczą się z "
                "wszystkich Twoich wpisów — im dłużej używasz aplikacji, tym są dokładniejsze.")

    if _pick(["dane", "prywatn", "bezpieczn", "kto widzi"], msg):
        return ("Twoje dane są szyfrowane i widoczne tylko dla Ciebie. Logujesz się hasłem, a "
                "my nie udostępniamy niczego osobom trzecim. Forum i artykuły są publiczne "
                "wewnątrz aplikacji, ale Twoje wpisy i kalendarz pozostają prywatne. ")

    if _pick(["gdzie jestem", "co to jest", "co umiesz", "co potrafi"], msg):
        return ("Jestem asystentem Cyklia. Potrafię odpowiadać na pytania o: owulację i dni "
                "płodne, PMS, bóle miesiączkowe, temperaturę bazową, sen, suplementy i "
                "zdrowy tryb życia. Pamiętaj, że moje odpowiedzi są edukacyjne i nie "
                "zastępują wizyty u lekarza.")

    return (
        "Chętnie pomogę! Zapytaj mnie o owulację, dni płodne, PMS, bóle miesiączkowe, "
        "temperaturę, sen, suplementy albo o to, jak używać aplikacji. 🙂 "
        "Pamiętaj, że to informacje edukacyjne — nie zastępują porady medycznej."
    )


def llm_reply(message, api_url, api_key, model, history):
    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Jesteś uprzejmym asystentem zdrowia kobiet i śledzenia cyklu "
                    "miesiączkowego (aplikacja Cyklia). Odpowiadaj po polsku, zwięźle, "
                    "życzliwie i empatycznie. To treści edukacyjne, nie diagnoza. "
                    "Przy poważnych objawach doradzaj konsultację z lekarzem."
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


def reply(message, history=None):
    history = history or []
    api_url = os.environ.get("CYKLIA_LLM_API")
    api_key = os.environ.get("CYKLIA_LLM_KEY")
    model = os.environ.get("CYKLIA_LLM_MODEL", "meta-llama/llama-3.3-70b-instruct")
    if api_url and api_key:
        try:
            return llm_reply(message, api_url, api_key, model, history)
        except Exception:
            return local_reply(message) + (
                "\n\n(Uwaga: połączenie z modelem AI chwilowo nie zadziałało, "
                "więc odpowiadam lokalnie.)"
            )
    return local_reply(message)
