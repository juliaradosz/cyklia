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
  cykle, dopóki nie wypadnie po dzisiejszym dniu).
- Owulacja = następny okres − 14 dni. Dni płodne = owulacja −5 … +1.

### Tabletki / plastry
- Brak owulacji i dni płodnych.
- Następny okres = początek najbliższej przerwy: `kotwica + dni_aktywne + k·(aktywne+przerwa)`.
- Plastry: stały schemat 21+7 liczony od początku okresu (zmiana w dni 1, 8,
  15; zdjęcie w dniu 22; przerwa 23–28).
- W kalendarzu przy antykoncepcji okres pokazywany jest **tylko z rejestracji
  użytkowniczki** (nie z prognozy).

### Kotwica blistra (`pillsched.pill_anchor`)
- Szuka w dzienniku tabletek ostatniego „początku blistra” = wpisu, przed
  którym była przerwa w logowaniu ≥ `max(2, (przerwa+1)//2 + 1)` dni
  (dla 21+7 → 5 dni). Dzięki temu:
  - wcześniej rozpoczęty blister przesuwa prognozę okresu wcześniej,
  - pojedynczy zapomniany wpis nie resetuje blistra,
  - codzienne zaznaczanie **nie przesuwa** kotwicy (dawny błąd: brano najstarszy
    wpis z ostatnich 28 dni, więc kotwica „jechała” z każdym dniem i np. 3.
    dzień nowego blistra był pokazywany jako przerwa).
- Jeśli ostatni początek blistra jest starszy niż jeden pełny cykl → data
  startu z profilu; gdy jej brak → ostatni znaleziony początek.
- Przy przerwie 0 dni kotwica = data z profilu (tabletka codziennie).

### Klasyfikacja dnia (`day_type_for`)
`period` (zarejestrowany okres; bez daty końca = długość okresu z profilu),
`ovulation`, `fertile`, `normal`.

## 6. Tabletki — dzienny log

- `GET/POST/DELETE /api/pills/log` (+ `?date=`). Zapis tylko w dni aktywne
  (w przerwie → błąd 400).
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

## 8. Dziennik, statystyki, raport, czat

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
  `groq_key.py`) lub z lokalnych reguł. Asystent dostaje kontekst kalendarza
  (dzień cyklu, następny okres, owulacja, tabletka/plaster).

## 9. Historia zmian logiki

- **2026-11-04** — strefa czasowa Polski na serwerze; poprawiona kotwica
  blistra; zapis długości okresu (1–14); przerwa 0 dni w tabletkach;
  walidacja dat okresu (koniec ≥ początek); bezpieczne hasła PBKDF2 z migracją;
  zmiana hasła i usuwanie konta; automatyczne wylogowanie po 401;
  powiadomienia push (tabletka, plaster, okres, dni płodne) + cron.
