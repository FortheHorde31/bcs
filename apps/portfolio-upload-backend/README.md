# Локальный прототип

Прототип показывает полный тестовый поток:

```text
HTML-компонент
→ presigned PUT
→ Timeweb S3
→ подтверждение загрузки
→ mock-анализатор
→ подписанный HTTP callback
→ polling
→ оценка 6/10
```

## Статус проверки

29 июля 2026 года успешно проверены:

- локальный запуск backend;
- генерация presigned PUT URL;
- загрузка тестового PDF напрямую в Timeweb S3;
- проверка наличия объекта backend;
- CORS для локального и временного публичного origin;
- mock-анализатор;
- подписанный HTTP callback через публичный HTTPS-туннель;
- polling статуса;
- возврат результата `6/10`.

## Запуск

```bash
cd apps/portfolio-upload-backend
npm start
```

По умолчанию backend:

- запускается на `http://127.0.0.1:8787`;
- читает S3-параметры из `tools/S3/.env`;
- не выводит Access Key и Secret Key;
- создает объекты в префиксе `portfolio-prototype/`;
- возвращает mock-оценку `6/10` через 5 секунд.

Открыть:

- демо: `http://127.0.0.1:8787`;
- HTML для T123: `http://127.0.0.1:8787/tilda-block.html`;
- исходный код для копирования в T123: `http://127.0.0.1:8787/tilda-snippet.txt`;
- healthcheck: `http://127.0.0.1:8787/api/health`.

## Переменные

| Переменная | Значение по умолчанию |
|---|---|
| `PORT` | `8787` |
| `PORTFOLIO_ENV_FILE` | `tools/S3/.env` относительно workspace |
| `S3_PREFIX` | `portfolio-prototype` |
| `UPLOAD_URL_TTL_SECONDS` | `600` |
| `MOCK_ANALYSIS_DELAY_MS` | `5000` |
| `MOCK_SCORE` | `6` |
| `PUBLIC_BASE_URL` | локальный адрес |
| `ALLOWED_ORIGINS` | `*` только для прототипа |
| `PROTOTYPE_API_TOKEN` | случайное значение на каждый запуск |
| `CALLBACK_SECRET` | случайное значение на каждый запуск |

## CORS Timeweb S3

Для прямой загрузки из браузера бакет должен разрешать:

- origin локальной страницы или публичного туннеля;
- метод `PUT`;
- заголовок `Content-Type`.

В production нельзя использовать `AllowedOrigins: ["*"]`.

Добавить origin:

```bash
npm run cors -- --apply --origin=http://127.0.0.1:8787
```

Посмотреть текущие правила:

```bash
npm run cors
```

## Автоматический end-to-end тест

При запущенном backend:

```bash
npm run test:flow
```

Для публичного туннеля:

```bash
TEST_BASE_URL=https://<адрес-туннеля> npm run test:flow
```

Тест создает задание, загружает небольшой файл из `fixtures/`, подтверждает объект,
дожидается callback и проверяет результат `6/10`.

## Вставка в Tilda

После запуска публичного туннеля открыть:

```text
https://<адрес-туннеля>/tilda-block.html
```

Скопировать содержимое в блок T123. Backend автоматически подставит публичный URL и временный prototype token.

Токен в браузере не является полноценной защитой. Для закрытого теста он уменьшает вероятность случайного использования endpoint; перед production нужны CAPTCHA, rate limit и согласованные ограничения.
