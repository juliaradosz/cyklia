# Cyklia — tracker cyklu i zdrowia (PWA)

Aplikacja webowa (działa w przeglądarce i na telefonie — można ją dodać do ekranu
głównego z Safari) z backendem w Pythonie/Flasku, przeznaczona do wdrożenia na
**PythonAnywhere**.

## Funkcje

- Konto użytkownika (rejestracja / logowanie, JWT) i synchronizacja w chmurze
- Kalendarz cyklu z prognozą owulacji i dni płodnych (uczy się z Twoich wpisów)
- **Tryb tabletek antykoncepcyjnych**: wybierz swój środek (baza ~20 popularnych
  tabletek) — kalendarz dopasowuje się: brak owulacji i dni płodnych, okres
  przewidywany w przerwie między blistrami
- Dashboard pokazujący **który to dzień okresu**, dzień cyklu i za ile dni
  kolejny okres
- Dziennik: 16 nastrojów, 23 objawy, temperatura bazowa, waga, libido, śluz
  szyjkowy, poziom stresu, sen, woda, aktywność i notatki — z listą zapisanych
  wpisów i możliwością edycji
- Statystyki: średnia długość cyklu i okresu, wykres temperatury, nastroje, objawy
- **Darmowy czat AI, bez limitu** — asystent zna Twój kalendarz i podaje
  konkretne daty (kolejny okres, owulacja, dni płodne). Działa lokalnie, bez
  płatnych API; można podpiąć własny klucz do darmowych modeli — patrz niżej
- Artykuły edukacyjne o cyklu i zdrowiu
- PWA — instalacja na telefonie, ikona na ekranie głównym

## Struktura

```
cyklia/
├── backend/            # Python + Flask (API + serwowanie frontendu)
│   ├── app.py          # aplikacja i wszystkie endpointy
│   ├── auth.py         # logowanie JWT
│   ├── database.py     # warstwa SQLite
│   ├── cycle.py        # prognoza cyklu / owulacji
│   ├── chat_bot.py     # darmowy asystent (reguły + opcjonalny LLM)
│   ├── seed.py         # domyślne artykuły
│   ├── wsgi.py         # punkt wejścia dla PythonAnywhere
│   └── requirements.txt
└── frontend/           # React + Vite + PWA
    └── dist/           # zbudowany frontend (serwowany przez Flask)
```

## Uruchomienie lokalne

Wymagania: Python 3.10+, Node.js 18+.

```powershell
# 1. Backend
cd cyklia
py -3 -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements.txt

# 2. Frontend (tylko raz, żeby powstał katalog dist/)
cd frontend
npm install
npm run build

# 3. Start (Flask serwuje i API, i frontend)
cd ..
.venv\Scripts\python backend\app.py
```

Otwórz http://127.0.0.1:5000

### Tryb deweloperski (szybszy)

W jednym terminalu:
```powershell
.venv\Scripts\python backend\app.py
```
W drugim:
```powershell
cd frontend
npm run dev
```
Otwórz http://127.0.0.1:5173 (Vite proxy przekazuje /api do Flask na porcie 5000).

---

# Wdrożenie na PythonAnywhere (darmowy plan)

Cel: strona https://twojanazwa.pythonanywhere.com, darmowy certyfikat HTTPS,
baza SQLite w katalogu domowym.

## Krok 1 — konto i przesłanie plików

1. Załóż darmowe konto na https://www.pythonanywhere.com
2. Przejdź do zakładki **Files** i wgraj zawartość katalogu `backend/` do
   `/home/twojanazwa/cyklia/backend/` (możesz też wgrać cały projekt i przenieść).
   Najwygodniej: wrzuć pliki na GitHub i sklonuj w konsoli, albo przeciągnij
   pliki w interfejsie **Files**.

   Na serwerze musi być:
   - `/home/twojanazwa/cyklia/backend/` — pliki `.py` + `requirements.txt`
   - `/home/twojanazwa/cyklia/frontend/dist/` — **cała zawartość** zbudowanego
     frontendu (z `cyklia\frontend\dist`, po `npm run build`). Możesz ją wgrać
     przez **Files**, klikając „Upload to here" wewnątrz folderu. Wgrany katalog
     musi zawierać m.in. `index.html`, `assets/`, `icons/`, `sw.js`,
     `manifest.webmanifest`.

## Krok 2 — wirtualne środowisko

W konsoli Bash PythonAnywhere (zakładka **Consoles → Bash**):

```bash
cd ~/cyklia
python3.10 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

## Krok 3 — utworzenie aplikacji web

1. Zakładka **Web** → **Add a new web app**.
2. Wybierz **Manual configuration** → **Python 3.10**.
3. W sekcji *Code*:
   - **Source code**: `/home/twojanazwa/cyklia/backend`
   - **Working directory**: `/home/twojanazwa/cyklia/backend`
   - **Virtualenv**: `/home/twojanazwa/cyklia/venv`
4. Kliknij **Edit WSGI configuration file** i zastąp całość:

```python
import sys
path = '/home/twojanazwa/cyklia/backend'
if path not in sys.path:
    sys.path.append(path)
from wsgi import application
```

   (zamień `twojanazwa` na swoją nazwę użytkownika)

## Krok 4 — pliki statyczne (opcjonalnie, ale zalecane)

W zakładce **Web** sekcja *Static files*, dodaj:

- **URL**: `/assets/` → **Directory**: `/home/twojanazwa/cyklia/frontend/dist/assets/`
- **URL**: `/icons/` → **Directory**: `/home/twojanazwa/cyklia/frontend/dist/icons/`
- **URL**: `/manifest.webmanifest` → **Directory**: `/home/twojanazwa/cyklia/frontend/dist/manifest.webmanifest` (wystarczy podać katalog nadrzędny: `/home/twojanazwa/cyklia/frontend/dist/`)
- **URL**: `/sw.js` → **Directory**: `/home/twojanazwa/cyklia/frontend/dist/sw.js`

Można też zamiast tego po prostu nic nie konfigurować — Flask sam serwuje
frontend z `dist/`. Konfiguracja statyk przyspiesza tylko ładowanie plików.

## Krok 5 — restart i test

Kliknij **Reload**. Wejdź na https://twojanazwa.pythonanywhere.com — powinien
pojawić się ekran rejestracji. Zarejestruj konto i dodaj pierwszy okres w
kalendarzu.

## Instalacja na telefonie (iPhone / Safari)

1. Otwórz stronę w Safari.
2. Dotknij ikony **Udostępnij** (kwadrat ze strzałką w górę).
3. Wybierz **Dodaj do ekranu głównego**.
4. Kliknij **Dodaj** — na ekranie głównym pojawi się ikona Cyklia.

Na Androidzie/Chrome: menu ⋮ → **Dodaj do ekranu głównego**.

> Uwaga: darmowy plan PythonAnywhere usypia aplikację po bezczynności.
> Pierwsze wejście po chwili może trwać kilka sekund — to normalne.

## Darmowy czat AI

Domyślnie asystent odpowiada lokalnie (reguły) — **bez żadnych opłat i kluczy**.
To nie jest jednak prawdziwa AI: zna tylko wcześniej przygotowane tematy
(owulacja, PMS, bóle, temperatura, śluz, tabletki, nieregularne cykle itd.).
Na pytania spoza tych tematów odpowiedź będzie ogólna.

Jeśli chcesz, żeby asystent odpowiadał **na dowolne pytanie** jak prawdziwa
sztuczna inteligencja, podłącz darmowy model. Najprościej przez **Groq**
(darmowy klucz na https://console.groq.com) — inne darmowe opcje: OpenRouter
(`:free` modele), Google AI Studio (Gemini).

### Lokalnie (Windows)
Ustaw zmienne w systemie lub przed uruchomieniem:

```
set CYKLIA_LLM_API=https://api.groq.com/openai/v1/chat/completions
set CYKLIA_LLM_KEY=twoj_klucz_z_groq
set CYKLIA_LLM_MODEL=llama-3.3-70b-versatile
```

### Na PythonAnywhere
W zakładce **Web → Environment variables** dodaj trzy zmienne:

```
CYKLIA_LLM_API=https://api.groq.com/openai/v1/chat/completions
CYKLIA_LLM_KEY=twoj_klucz_z_groq
CYKLIA_LLM_MODEL=llama-3.3-70b-versatile
```

potem kliknij **Reload**. Bez tych zmiennych aplikacja i tak działa — lokalny
asystent jest całkowicie darmowy i zna Twój kalendarz (podaje daty okresu,
owulacji, dzień cyklu).

## Bezpieczeństwo danych

- Hasła są przechowywane jako skróty (SHA-256 z saltem w nazwie domeny).
- Tokeny JWT wygasają po 30 dniach.
- Każdy użytkownik widzi wyłącznie swoje dane kalendarza i dziennika.
- W aplikacji brak śledzenia i udostępniania danych osobom trzecim.

---

## Czego można dodać w przyszłości

- Wykresy i eksport danych (CSV/PDF)
- Push powiadomienia o okresie i dniach płodnych
- Przypomnienia o mierzeniu temperatury
- Integracja z Apple Health / Google Fit
- Uwierzytelnianie przez Google/Apple
