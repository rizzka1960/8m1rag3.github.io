# Сайт 8M1RAG3

Статический сайт, без сборки: просто залить папку на любой хостинг.

- `index.html` — главная (сигнал, о проекте, каналы YouTube, вход к загадкам)
- `puzzles.html` — ввод ключей загадок
- `lift.html` — уровень I «Лифт» (ответы и генератор лежат вне репозитория)
- `privacy.html`, `terms.html` — Privacy Policy и Terms of Service для аудита YouTube API
- `site.js` — настройки сверху файла:
  - `NEXT_SIGNAL` — дата окончания обратного отсчёта (UTC);
  - `GOATCOUNTER` — код сайта в GoatCounter (аналитика без cookie), пусто = выключено.
- `puzzles-data.js` — зашифрованные данные загадок (генерируются вне репозитория, руками не править)


Локальный просмотр: `python -m http.server 8331`, затем http://localhost:8331
