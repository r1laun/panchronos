# Панхронос — MVP

Дневник «Ответ — Мысль — Вопрос». Вопрос из записи N получает ответ в записи N+14 (лаг по порядковому номеру, не по дате). Vanilla HTML/JS + Supabase. Без сборки, без напоминаний, RU/EN.

## Быстрый старт

1. **Создайте проект Supabase** (https://supabase.com → New project).
2. **Auth → Sign In / Sign Up:** включите Email provider, включите `Confirm email`.
   Authentication → URL Configuration → добавьте Site URL (ваш домен) и `http://localhost:8000` для локальной проверки.
3. **SQL Editor:** прогоните `supabase/migration.sql` целиком.
4. **Ключи:** Settings → API → скопируйте `Project URL` и `anon public key`:
   ```bash
   cp config.example.js config.js
   ```
   Впишите значения в `config.js` (или держите参照 `.env.example`).
5. **Запуск локально:**
   ```bash
   python3 -m http.server 8000
   # открыть http://localhost:8000/index.html
   ```
   Открыть файл напрямую через `file://` не выйдет — ES-модули и Supabase требуют http(s).
6. **Проверка:** регистрация → письмо-подтверждение → вход → запись №1 (поле «Ответ» disabled, «Появится на записи №15») → повторная попытка в тот же день даёт countdown до полуночи UTC → `archive.html` показывает единый текст без ярлыков.

## Механика (как закодировано)

- `entry_number = max(entry_number пользователя) + 1`, `unique(user_id, entry_number)`.
- 1 запись/сутки: generated-колонка `entry_day = (created_at AT TIME ZONE 'UTC')::date`, `unique(user_id, entry_day)` — источник истины в БД, в UI дублируется проверкой + countdown `Date.UTC(...след. полночь) - now`.
- №1–14: `answer = null`, поле disabled. №15+: обязательный ответ + контекст `thought + question` записи N−14 (без её answer).
- Неизменяемость: на таблице нет политик UPDATE/DELETE + нет кнопок в UI.
- Приватность: RLS `select/insert own` по `auth.uid() = user_id`.
- Архив: `ORDER BY entry_number DESC`, рендер абзацами `[answer?] + thought + question` без «Ответ:/Мысль:/Вопрос:».
- Гонка двойного сабмита: при `23505` по номеру — один пересчёт max и retry; при `23505` по дню — показ countdown.

## Деплой на GitHub Pages

`config.js` с ключами в репозиторий **не коммитится** (он в `.gitignore`).
Workflow `.github/workflows/deploy.yml` генерирует его при деплое из GitHub Secrets.

1. Создайте проект Supabase (секция выше), возьмите `Project URL` и `anon public key`.
2. Создайте репозиторий и запушьте код:
   ```bash
   git init
   git add .
   git commit -m "Panchronos MVP"
   git branch -M main
   git remote add origin git@github.com:<user>/<repo>.git
   git push -u origin main
   ```
3. В репозитории: Settings → Secrets and variables → Actions → New repository secret:
   - `SUPABASE_URL` = `https://xyzcompany.supabase.co`
   - `SUPABASE_ANON_KEY` = anon public key
4. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
5. Запушьте любой коммит в `main` (или Actions → Run workflow) → сайт появится на
   `https://<user>.github.io/<repo>/index.html`.
6. Этот URL добавьте в Supabase Auth → URL Configuration → Redirect URLs
   (иначе confirmation/reset-ссылки не вернутся на сайт).

Если на сайте висит «Не задан SUPABASE_URL…» — не заданы Secrets (п.3) или workflow
не отработал: смотрите вкладку Actions в репозитории.

## Деплой прочей статики

Любой статический хостинг: Vercel / Netlify / GitHub Pages. Корень — эта папка. После деплоя добавьте production-URL в Supabase Auth → Redirect URLs. `config.js` с реальными ключами залейте отдельно (он в `.gitignore`).

## Структура

- `index.html` — auth / verify-gate / форма записи №N / countdown
- `archive.html` — полный личный архив
- `app.js` — Supabase client + вся логика
- `i18n.js` — словарь RU/EN
- `styles.css` — минимальный адаптив
- `supabase/migration.sql` — схема + RLS
- `config.example.js` / `config.js` / `.env.example` — ключи
