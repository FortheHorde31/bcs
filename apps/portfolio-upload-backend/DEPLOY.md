# Постоянный MVP на Timeweb App Platform

## Что получится

```text
Tilda T123
   │
   ├── POST /api/uploads/init
   │       backend создает presigned URL
   │
   ├── PUT напрямую в Timeweb S3
   │
   ├── POST /api/uploads/{job_id}/complete
   │       backend подтверждает файл
   │
   ├── GET /api/jobs/{job_id}
   │       Tilda забирает статус и score
   │
   └── внешний анализатор
           POST /api/analysis-callback
           backend принимает результат
```

Tilda не принимает webhook. Webhook принимает backend, сохраняет результат, а
JavaScript-компонент на странице Tilda забирает его через polling.

## Почему App Platform

Для MVP не нужен отдельный администрируемый VPS:

- Timeweb самостоятельно запускает Node.js;
- выдает постоянный публичный адрес;
- выпускает SSL;
- хранит переменные окружения;
- перезапускает приложение;
- показывает логи;
- умеет автоматически обновляться из Git-репозитория.

## Шаг 1. Разместить код в Git

В отдельный репозиторий нужно положить содержимое папки `prototype/`.

Минимально необходимы:

```text
package.json
server.mjs
public/
Dockerfile
```

Файлы `.env`, `tools/S3/.env` и реальные ключи в Git не добавлять.

## Шаг 2. Создать Backend в Timeweb

В панели Timeweb:

1. Открыть `App Platform`.
2. Нажать «Добавить».
3. Выбрать тип `Backend`.
4. Подключить GitHub, GitLab, Bitbucket или URL Git-репозитория.
5. Выбрать репозиторий и ветку.
6. Выбрать Node.js либо деплой из `Dockerfile`.
7. Для минимального MVP выбрать самую маленькую backend-конфигурацию.
8. Команда запуска: `npm start`.
9. Healthcheck: `/api/health`.

Если выбирается Dockerfile, порт контейнера — `8787`.

## Шаг 3. Добавить переменные

В настройках приложения добавить значения из `.env.example`:

```text
HOST=0.0.0.0
S3_ENDPOINT=https://s3.timeweb.cloud
S3_REGION=ru-1
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PREFIX=portfolio-mvp
PROTOTYPE_API_TOKEN=<случайная строка>
CALLBACK_SECRET=<другая случайная строка>
MOCK_ANALYZER_ENABLED=true
MOCK_ANALYSIS_DELAY_MS=5000
MOCK_SCORE=6
STATE_FILE=data/jobs.json
```

После первого деплоя Timeweb выдаст адрес, например:

```text
https://portfolio-mvp-xxxx.timeweb.cloud
```

После этого добавить:

```text
PUBLIC_BASE_URL=https://portfolio-mvp-xxxx.timeweb.cloud
ALLOWED_ORIGINS=https://адрес-опубликованной-страницы-tilda
```

И перезапустить деплой.

## Шаг 4. Настроить CORS бакета S3

В панели Timeweb S3 добавить CORS-правило:

```text
Allowed Origins:
https://адрес-опубликованной-страницы-tilda

Allowed Methods:
PUT
GET
HEAD

Allowed Headers:
Content-Type

Expose Headers:
ETag

Max Age:
600
```

Важно: origin — это адрес страницы Tilda, потому что именно браузер на этой
странице отправляет PUT в S3.

Если используются отдельные preview и production адреса Tilda, добавить два
отдельных правила.

## Шаг 5. Проверить backend

Открыть:

```text
https://<backend>/api/health
```

Ожидаемый ответ:

```json
{
  "ok": true,
  "service": "portfolio-upload-prototype",
  "storage": "timeweb-s3",
  "mock_analyzer": true
}
```

## Шаг 6. Вставить блок в Tilda

Открыть `public/tilda-block-mvp.html`.

Заменить:

```text
https://YOUR-BACKEND
```

на публичный адрес Timeweb App Platform.

Заменить:

```text
YOUR-PROTOTYPE-TOKEN
```

на значение `PROTOTYPE_API_TOKEN`.

Вставить весь код в T123, сохранить и опубликовать страницу. В preview Tilda
кастомный JavaScript может не работать, поэтому проверять нужно опубликованную
страницу.

## Шаг 7. Пройти mock pipeline

1. Открыть опубликованную страницу Tilda.
2. Выбрать тестовый PDF.
3. Дождаться загрузки в S3.
4. Backend сам отправит mock callback через пять секунд.
5. В блоке появится `6/10`.

На этом четыре части MVP проверены.

## Шаг 8. Подключить «черный ящик»

Передать владельцу анализатора:

```text
Callback URL:
POST https://<backend>/api/analysis-callback

Headers:
X-Callback-Id
X-Callback-Timestamp
X-Callback-Signature

Body:
{
  "job_id": "job_...",
  "status": "completed",
  "score": 6
}
```

После согласования подписи:

```text
MOCK_ANALYZER_ENABLED=false
```

Теперь backend будет ждать callback реального сервиса.

## Что обязательно сделать до реальных клиентских файлов

- ограничить `ALLOWED_ORIGINS` точным доменом Tilda;
- включить rate limit и CAPTCHA;
- проверить фактический тип файла;
- добавить антивирус и карантин;
- согласовать срок удаления файлов;
- согласовать обработку персональных данных;
- вынести статусы из JSON в постоянную БД при росте нагрузки;
- заменить видимый prototype token на production-механизм защиты.

