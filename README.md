# MerchAI

Веб-сервис для генерации концепций корпоративного мерча и подготовки заявки на производство.

Текущая версия работает как конструктор:

- клиент выбирает тип товара, шаблон и цвет основы;
- клиент выбирает палитру дизайна для генерации принта;
- описывает задачу в одном свободном поле;
- может загрузить логотип или картинку;
- сервис генерирует 3 варианта принта через YandexART, OpenAI Image API или Replicate;
- браузер накладывает выбранный принт на пустой шаблон товара;
- клиент смотрит макет спереди и сзади;
- клиент может вручную настроить размер, позицию, поворот и прозрачность принта;
- клиент может добавить читаемую надпись отдельным текстовым слоем;
- после выбора варианта заполняет заявку на производство.

## Файлы

- `server.js` - Express-сервер, image API-провайдеры, заявки.
- `public/index.html` - интерфейс конструктора, мокапы, ручная посадка принта, текстовый слой, загрузка файла, форма заказа.
- `public/assets/merchai-logo.jpg` - логотип.
- `public/assets/mockups/` - пустые мокапы товаров для наложения принтов.
- `.env.example` - пример локальных переменных окружения.
- `render.yaml` - конфигурация Render.

## Локальный запуск

```bash
npm install
npm start
```

Открыть:

```text
http://localhost:3000
```

Health-check:

```text
http://localhost:3000/api/health
```

## Переменные окружения

Создайте `.env` по примеру `.env.example`:

```env
YANDEX_API_KEY=ваш_api_key
YANDEX_FOLDER_ID=ваш_folder_id
IMAGE_PROVIDER=yandex
PORT=3000
```

`.env` нельзя публиковать в GitHub.

Для Yandex Cloud нужны роли:

```text
ai.imageGeneration.user
```

Если позже снова понадобится текстовая генерация через YandexGPT, добавьте также:

```text
ai.languageModels.user
```

## Render

Для Render используйте:

```text
Environment: Node
Build Command: npm install
Start Command: npm start
```

В `Environment Variables` добавьте:

```text
YANDEX_API_KEY
YANDEX_FOLDER_ID
IMAGE_PROVIDER
```

## Провайдеры генерации

По умолчанию используется `IMAGE_PROVIDER=yandex`.

Для OpenAI:

```env
IMAGE_PROVIDER=openai
OPENAI_API_KEY=ваш_openai_api_key
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_QUALITY=medium
OPENAI_IMAGE_SIZE=1024x1024
OPENAI_IMAGE_FORMAT=png
OPENAI_IMAGE_BACKGROUND=transparent
```

Для бюджетного теста через Replicate:

```env
IMAGE_PROVIDER=replicate
REPLICATE_API_TOKEN=ваш_replicate_token
REPLICATE_IMAGE_MODEL=black-forest-labs/flux-schnell
```

Если ключ выбранного провайдера не задан, сервис покажет демо-варианты без ошибки интерфейса.

## Cloudflare Pages без карты

Проект можно выложить бесплатно через Cloudflare Pages без платежной карты. Для этого используется статический frontend из `public/` и Pages Functions из `functions/`.

Настройки Cloudflare Pages:

```text
Framework preset: None
Build command: оставить пустым
Build output directory: public
Root directory: /
```

В `Settings` -> `Environment variables` добавьте:

```text
YANDEX_API_KEY
YANDEX_FOLDER_ID
```

Cloudflare Functions:

- `functions/api/generate-start.js` запускает генерацию YandexART и сразу возвращает operation id.
- `functions/api/generate-status.js` проверяет готовность изображений.
- `functions/api/order.js` принимает заявку в демо-режиме без постоянного хранения.

Такой режим нужен потому, что YandexART генерирует изображения асинхронно, а serverless-функции не должны держать один запрос 60-90 секунд.

## Заявки

Сейчас `/api/order` сохраняет заявки локально в:

```text
orders/orders.jsonl
```

Папка `orders/` добавлена в `.gitignore`. На Render бесплатного тарифа такое хранение не является постоянной базой данных. Для боевого сценария лучше подключить отправку в почту, Telegram, CRM, Google Sheets или базу данных.

## Важные ограничения

- YandexART плохо рисует читаемый текст, поэтому текст и логотипы лучше накладывать отдельными слоями.
- Автоматический поиск мемов и картинок из интернета пока не подключен. Для публичного продукта нужен легальный Search API и фильтр лицензий.
- Пустые шаблоны лежат в `public/assets/mockups/`. Для точного результата нужно постепенно уточнять зоны печати под каждый конкретный мокап.
