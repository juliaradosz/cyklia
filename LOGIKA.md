# Cyklia — logika aplikacji

> Ten plik opisuje, **jak działa aplikacja** (reguły, obliczenia, przepływ danych).
> Jest aktualizowany przy każdej zmianie w kodzie. Ostatnia aktualizacja: 2026-11-04.

## 1. Architektura

- **Backend**: Python + Flask (`backend/`), baza SQLite (`backend/cyklia.db`).
  Flask serwuje zarówno API (`/api/...`), jak i zbudowany frontend (`frontend/dist/`).
- **Frontend**: React + Vite + PWA (`frontend/src/`). Zbudowany `dist/` jest
  w repozytorium, bo PythonAnywhere nie ma Node.js — **po każdej zmianie we
  frontendzie trzeba uruchomić `npm run build` i wgrać `dist/`**.
- **Wdrożenie**: PythonAnywhere, punkt wejścia `backend/wsgi.py`
  (tworzy tabele, migruje kolumny, synchronizuje artykuły).

### Moduły backendu

| Plik | Rola |
|---|---|
| `app.py` | Wszystkie endpointy API, status tabletki/plastra, kontekst dla czatu |
| `auth.py` | Hasła (PBKDF2), tokeny JWT (30 dni), dekorator `auth_required` |
| `database.py` | Schemat SQLite, migracje kolumn (`MIGRATIONS`), helpery `query/execute` |
| `localtime.py` | „Dziś” i „teraz” w strefie **Europe/Warsaw** (serwer działa w UTC) |
| `cycle.py` | Prognoza okresu/owulacji, klasyfikacja dni kalendarza |
| `pillsched.py` | Kotwica blistra (dzień 1 bieżącego opakowania tabletek) |
| `predict.py` | „Jak możesz się dziś czuć” + analiza dziennika (AI lub lokalnie) |
| `chat_bot.py` | Asystent: reguły lokalne lub model AI (Groq/OpenAI‑compatible) |
| `report.py` | Raport PDF dla ginekologa (fpdf2) |
| `notify.py` | Powiadomienia push (VAPID), wyliczanie należnych przypomnień |
| `send_reminders.py` | Skrypt do zadania zaplanowanego — wysyła przypomnienia |
| `pills.py`, `patches.py` | Baza tabletek (schematy 21+7, 24+4, 26+2, 28+0) i plastrów |
| `seed.py`, `articles_library.py` | Artykuły w sekcji Inspiracje |

## 2. Czas i daty

- Wszystkie „dziś/teraz” po stronie serwera liczone są przez `localtime`
  (domyślnie `Europe/Warsaw`, zmiana: zmienna `CYKLIA_TZ`). Bez tego między
  północą a 1:00/2:00 aplikacja pokazywała wczorajszy dzień, a godzina
  wzięcia tabletki była przesunięta o 1–2 godz.
- Frontend operuje na lokalnych datach `YYYY-MM-DD` (`utils.js`: `iso`, `todayISO`).

## 3. Konto i bezpieczeństwo

- Rejestracja: e-mail (z `@`), hasło min. 6 znaków.
- Hasła: `werkzeug` PBKDF2-SHA256 (600 000 iteracji, losowa sól). Stare konta
  (SHA-256 ze stałą solą) logują się normalnie, a hasło jest **automatycznie
  przehaszowane** do PBKDF2 przy pierwszym logowaniu.
- Token JWT ważny 30 dni; klucz w `backend/secret.key` (tworzony automatycznie).
  Token usuniętego konta zwraca 401.
- Frontend: każda odpowiedź 401 przy zalogowaniu → automatyczne wylogowanie
  (zdarzenie `cyklia:unauthorized`).
- Profil → Konto: zmiana hasła (`POST /api/me/password`) i usunięcie konta
  ze wszystkimi danymi (`DELETE /api/me`, wymaga hasła).

## 4. Ustawienia profilu (`PATCH /api/me`)

- Długość cyklu: 14–60 dni. Długość okresu: 1–14 dni (wcześniej błędnie
  14–60, przez co długość okresu się nie zapisywała).
- Metoda: bez hormonów / tabletki / plastry (włączenie jednej wyłącza drugą).
- Tabletki: nazwa, dni aktywne (1–30), przerwa (0–14 — **0 jest poprawną
  wartością**, np. Cerazette), pora przyjmowania `HH:MM`, data startu blistra.
- Powiadomienia: `notify_pill`, `notify_patch`, `notify_period`,
  `notify_fertile` (0/1) i `notify_period_days` (0–7).

## 5. Prognoza cyklu (`cycle.build_calendar`)

### Cykl naturalny
- Długość cyklu = ustawienie z profilu, a gdy brak — średnia odstępów między
  zapisanymi początkami okresów (domyślnie 28).
- Następny okres = ostatni początek + długość cyklu (przesuwany o kolejne
  cykle, dopóki nie wypadnie dziś lub później — w dniu prognozy aplikacja pokazuje „okres — dziś!”).
- Owulacja = następny okres − 14 dni. Dni płodne = owulacja −5 … +1.

### Tabletki / plastry
- Brak owulacji i dni płodnych.
- **Prognoza okresu przy tabletkach = 2 dni po ostatniej tabletce blistra**
  (jak w ulotkach: krwawienie z odstawienia zwykle 2–3 dni po ostatniej
  tabletce; przy przerwie krótszej niż 2 dni — w ostatnim dniu przerwy):
  `kotwica + dni_aktywne − 1 + min(2, przerwa)`, powtarzane co
  `aktywne + przerwa` dni, aż wypadnie dziś lub później.
- Tabletki bez przerwy (np. Cerazette, schemat 28+0): **brak prognozy okresu**.
- Kalendarz zwraca też `next_pack_start` (dzień 1 kolejnego blistra) i
  `last_pill_date` (ostatnia tabletka bieżącego blistra).
- Plastry: stały schemat 21+7 liczony od początku okresu (zmiana w dni 1, 8,
  15; zdjęcie w dniu 22; przerwa 23–28).
- W kalendarzu przy antykoncepcji okres pokazywany jest **tylko z rejestracji
  użytkowniczki** (nie z prognozy).

### Kotwica blistra (`pillsched.pill_anchor`)
Dzień 1 bieżącego blistra liczony z **faktycznie zaznaczonych tabletek**.
Przechodzimy po wpisach od najstarszego, startując od daty z profilu (jeśli jest):
- wpis sprzed daty startu z profilu → ignorowany,
- **tabletka zaznaczona w dniu, który wg harmonogramu jest przerwą →
  nowy blister od tego dnia** (zaczęty wcześniej); harmonogram, dni
  przerwy i prognoza okresu przesuwają się,
- tabletka po luce dłuższej niż `przerwa + 1` dni → nowy blister od tego dnia
  (zaczęty później niż planowo),
- tabletka w dniu aktywnym → trzyma się harmonogramu (pojedynczy zapomniany
  wpis niczego nie przesuwa; codzienne zaznaczanie nie przesuwa kotwicy),
- brak wpisów i brak daty w profilu → brak kotwicy.

### Klasyfikacja dnia (`day_type_for`)
`period` (zarejestrowany okres; bez daty końca = długość okresu z profilu),
`ovulation`, `fertile`, `normal`.

## 6. Tabletki — dzienny log

- `GET/POST/DELETE /api/pills/log` (+ `?date=`). Zapis także w dniu przerwy
  (= nowy blister wcześniej, patrz kotwica). Nie można zaznaczyć tabletki
  w przyszłości.
- Status zwraca m.in. `pack_day`, `in_break`, `active_days`, `break_days`,
  `next_pack_start`, `next_period_start`, `taken`, `taken_at`, `late`, `warning`.
- `pack_day`: dzień blistra (1…n) albo ujemny numer dnia przerwy.
- Spóźnienie: tabletka wzięta później niż 12 godz. (progestagenowe/bez
  przerwy: 3 godz.) po ustawionej porze → ostrzeżenie o możliwym spadku
  skuteczności.

## 7. Powiadomienia push

### Przepływ
1. Profil → Powiadomienia → przełącznik „na tym urządzeniu”: przeglądarka
   pyta o zgodę, `PushManager.subscribe()` z kluczem publicznym VAPID
   (`GET /api/push/public-key`), subskrypcja trafia do `POST /api/push/subscribe`
   (tabela `push_subscriptions`, wiele urządzeń na konto).
2. Wylogowanie usuwa subskrypcję tego urządzenia z konta.
3. Wysyłkę uruchamia **cron** co 10–15 min:
   - adres `GET /api/cron/reminders?key=<klucz>` (np. z cron-job.org),
     klucz: `python send_reminders.py --key` (plik `backend/cron.key`
     albo zmienna `CYKLIA_CRON_KEY`), albo
   - zadanie zaplanowane PythonAnywhere: `python send_reminders.py`.
4. Service worker (`frontend/public/push-sw.js`, dołączany do `sw.js`)
   pokazuje powiadomienie; kliknięcie otwiera właściwą stronę aplikacji.

### Reguły przypomnień (`notify.due_reminders`)
Każde przypomnienie wysyłane **najwyżej raz dziennie** (tabela `notification_log`).

| Rodzaj | Kiedy |
|---|---|
| `pill` | dzień aktywny, tabletka niezaznaczona, minęła ustawiona pora |
| `pill_late` | j.w., 2 godz. po porze |
| `patch` | dzień zmiany/zdjęcia plastra, niezaznaczone, 9:00–22:00 |
| `period_soon` | do prognozowanego okresu zostało `notify_period_days` dni, 9:00–22:00 |
| `period_today` | prognozowany okres dziś (i nie jest już zaznaczony), 9:00–22:00 |
| `fertile` | pierwszy dzień okna płodnego (tylko bez antykoncepcji), 9:00–22:00 |

- Subskrypcje zwracające 404/410 są automatycznie usuwane.
- Klucz VAPID: `backend/vapid_private.pem` (tworzony przy pierwszym użyciu,
  nie jest w Gicie — **nie usuwać**, inaczej trzeba ponownie włączyć
  powiadomienia na telefonach).
- iPhone: push działa tylko z aplikacji dodanej do ekranu głównego (iOS 16.4+).

## 8. Ekrany (zachowanie interfejsu)

- **Start**: tydzień (przesuwany), duży napis z odliczaniem do okresu
  („X dni do okresu”, „okres — dziś!”). W dniu okresu: „Okres / Dzień N”.
  W przerwie między blistrami: „Przerwa w tabletkach / Dzień X z Y · nowy
  blister …” (bez mylącego odliczania do okresu za miesiąc).
- **Karta tabletki** (Start): w dzień aktywny przycisk „Wzięłam” (zapisuje
  bieżącą godzinę; „Wzięłam o innej godzinie” pozwala ją zmienić). Po
  zaznaczeniu tabletki karta znika ze Startu (cofnąć można w dzienniku/kalendarzu).
  W przerwie: „Dziś bez tabletki” + „Zaczynam nowy blister dziś” (z
  potwierdzeniem).
- Przycisk „Dodaj okres / Edytuj okres” otwiera arkusz z datą początku i
  końca (dodawanie, gdy okres nie trwa; edycja i usuwanie, gdy trwa).
  Pod spodem (gdy okres trwa): „Okres skończył się dziś”.
- **Partner** (Profil → Partner): przycisk „Utwórz link dla partnera” tworzy
  prywatny link `/partner/<token>` (bez konta dla partnera). „Wyślij link
  partnerowi” otwiera systemowe udostępnianie (lub kopiuje link). Przełączniki
  „Co widzi partner”: jak mogę się dziś czuć, dni płodne, tabletki (domyślnie
  wyłączone). Widać, kiedy partner ostatnio otworzył link. „Utwórz nowy link”
  unieważnia stary, „Wyłącz udostępnianie” usuwa dostęp.
- **Kalendarz**: legenda; okres zarejestrowany = pełne różowe kółko,
  prognoza (3 kolejne okresy) = przerywane obramowanie, dni płodne =
  jasnoniebieskie, owulacja = niebieskie (tylko bez antykoncepcji), ikonka
  tabletki = zaznaczona tabletka. Dzień w przyszłości: brak zaznaczania
  okresu/tabletki. Dzień okresu: „Okres skończył się tego dnia”, „Usuń ten
  okres”. Dzień przerwy w tabletkach: „Nowy blister”. Nowy okres
  z kalendarza ma długość z profilu.
- **Objawy (dziennik)**: kolejność sekcji: tabletka/plaster, samopoczucie,
  objawy, krwawienie, seks i libido, wydzielina, trawienie, ciało, ruch i
  sen, temperatura i waga, notatka, analiza AI.
- API odrzuca okres zaczynający się w przyszłości.

## 9. Dziennik, statystyki, raport, czat

- Dziennik (`PUT /api/entries/<dzień>`): nastrój, objawy, temperatura, waga,
  libido, śluz, stres, sen, woda, aktywność, kroki, seks, krwawienie, trawienie,
  notatki. Listy zapisywane jako JSON.
- Statystyki: średnia długość cyklu (odstępy między początkami) i okresu
  (1–21 dni), temperatury, nastroje, objawy, średnie snu/kroków/aktywności
  w fazach (okres / folikularna / lutealna lub przerwa przy tabletkach).
- „Jak możesz się dziś czuć” i analiza dziennika: statystyka z historii wpisów
  w tej samej fazie; opis z modelu AI, a bez konfiguracji — lokalny szablon.
- Raport PDF dla ginekologa: `GET /api/report/pdf` (fpdf2, czcionki DejaVu).
- Czat: rozmowy w sesjach; odpowiedź z modelu AI (zmienne `CYKLIA_LLM_*` albo
  `groq_key.py`) lub z lokalnych reguł. Wszystkie wywołania AI idą przez
  `chat_bot.call_llm`: gdy skonfigurowany model jest wycofany
  (`model_not_found`), próbuje modeli zapasowych (`openai/gpt-oss-120b`,
  `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`) i zapamiętuje działający.
  Model zwraca się do użytkowniczki w formie żeńskiej. Asystent dostaje kontekst kalendarza
  (dzień cyklu, następny okres, owulacja, tabletka/plaster).

- Partner (`partner_shares`: token, przełączniki `show_feel`, `show_fertile`,
  `show_pills`, `last_viewed_at`): `GET/POST/PATCH/DELETE /api/partner`
  (zalogowana użytkowniczka) i publiczne `GET /api/p/<token>` (bez logowania).
  Widok zawsze pokazuje: nagłówek jak na Starcie (okres + dzień / przerwa
  w tabletkach / X dni do okresu), dzień cyklu (bez antykoncepcji), fazę
  i datę następnego okresu. Opcjonalnie: podpowiedź „jak może się dziś czuć”
  (`predict.partner_text` — statystyka z dziennika + model AI pisze do partnera
  o niej w 3. osobie, z pamięcią na dzień; bez AI szablon zależny od fazy),
  dni płodne (tylko bez antykoncepcji, gdy trwają lub są przed nami), stan
  tabletki. Nigdy nie pokazuje dziennika, notatek ani aktywności seksualnej.
  Usunięcie konta usuwa też link.

## 10. Historia zmian logiki

- **2026-11-04** — strefa czasowa Polski na serwerze; poprawiona kotwica
  blistra; zapis długości okresu (1–14); przerwa 0 dni w tabletkach;
  walidacja dat okresu (koniec ≥ początek); bezpieczne hasła PBKDF2 z migracją;
  zmiana hasła i usuwanie konta; automatyczne wylogowanie po 401;
  powiadomienia push (tabletka, plaster, okres, dni płodne) + cron.
- **2026-11-04 (2)** — harmonogram tabletek z faktycznie zaznaczonych
  tabletek (tabletka w przerwie = nowy blister), okres prognozowany 2 dni po
  ostatniej tabletce, brak prognozy dla tabletek bez przerwy; „okres dziś”
  pokazywany w dniu prognozy; nowa karta tabletki; dodawanie/kończenie/
  usuwanie okresu ze Startu i kalendarza; prognoza, dni płodne i legenda
  w kalendarzu; blokada dat w przyszłości; nowa kolejność dziennika.
- **2026-11-05** — karta tabletki znika po zaznaczeniu; usunięty przycisk
  „Okres zaczął się dziś” ze Startu; naprawione AI (asystent, analiza
  dziennika, „jak możesz się czuć”) — model Groq `llama-3.3-70b-versatile`
  został wycofany, dodany automatyczny model zapasowy.
- **2026-11-05 (2)** — udostępnianie partnerowi: prywatny link tylko do
  odczytu z dzisiejszym stanem cyklu i podpowiedzią AI, jak wspierać.
