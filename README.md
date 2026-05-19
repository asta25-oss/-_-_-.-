# MerchAI

Одностраничный сайт для генерации концепций корпоративного мерча через YandexGPT.

## Что внутри

- `public/index.html` - интерфейс сайта.
- `server.js` - Node.js/Express сервер и безопасный запрос к YandexGPT.
- `.env.example` - пример локальных переменных окружения.
- `.gitignore` - защита от случайной публикации `.env` и `node_modules`.
- `package.json` - зависимости и команда запуска.

## Важно про GitHub Pages

GitHub Pages подходит только для статического HTML/CSS/JS. В этом проекте есть серверный маршрут `/api/generate` и секретный `YANDEX_API_KEY`, поэтому рабочую версию с YandexGPT нужно размещать на Node.js-хостинге: Render, Railway, VPS, Yandex Cloud или похожем сервисе.

GitHub лучше использовать как хранилище кода, а публичный сайт запускать на хостинге, который умеет хранить переменные окружения.

## Локальный запуск

1. Установите Node.js LTS: https://nodejs.org/en/download
2. Установите Git for Windows, если хотите отправлять проект в GitHub с компьютера: https://git-scm.com/download/win
3. Скопируйте `.env.example` в `.env`.
4. Заполните `.env`:

```env
YANDEX_API_KEY=ваш_api_key
YANDEX_FOLDER_ID=ваш_folder_id
PORT=3000
```

5. Установите зависимости:

```bash
npm install
```

6. Запустите сайт:

```bash
npm start
```

7. Откройте:

```text
http://localhost:3000
```

Проверка сервера:

```text
http://localhost:3000/api/health
```

## Как получить ключи Yandex Cloud

1. Откройте Yandex Cloud: https://console.yandex.cloud
2. Создайте или выберите каталог.
3. Скопируйте `YANDEX_FOLDER_ID`.
   Официальная инструкция: https://yandex.cloud/docs/resource-manager/operations/folder/get-id
4. Создайте сервисный аккаунт.
5. Выдайте сервисному аккаунту права для работы с Foundation Models / YandexGPT.
   Для полной версии с картинками нужны две роли:

```text
ai.languageModels.user
ai.imageGeneration.user
```

6. Создайте API-ключ сервисного аккаунта.
   Официальная инструкция: https://yandex.cloud/ru/docs/iam/operations/api-key/create
7. Сохраните секретный ключ сразу. После закрытия окна Yandex Cloud может больше не показать его полностью.

Если при создании API-ключа доступен выбор области действия, добавьте доступ к генерации текста и изображений: `yc.ai.languageModels.execute` и `yc.ai.imageGeneration.execute` / `yc.ai.foundationModels.execute`, если такие пункты есть в интерфейсе.

## Деплой на Render

1. Создайте репозиторий GitHub: https://github.com/new
2. Загрузите туда файлы проекта. Не загружайте `.env`.
3. Откройте Render: https://render.com
4. Нажмите `New` -> `Web Service`.
5. Подключите GitHub-репозиторий.
6. Укажите настройки:

```text
Environment: Node
Build Command: npm install
Start Command: npm start
```

7. В разделе `Environment Variables` добавьте:

```text
YANDEX_API_KEY=ваш_api_key
YANDEX_FOLDER_ID=ваш_folder_id
```

8. Нажмите `Deploy Web Service`.
9. После деплоя Render даст публичный адрес вида:

```text
https://your-project.onrender.com
```

Официальные инструкции Render:

- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/environment-variables

## Подключение домена

1. Купите домен у регистратора.
2. В настройках Render откройте ваш Web Service.
3. Перейдите в `Settings` -> `Custom Domains`.
4. Добавьте домен, например:

```text
merchai.ru
www.merchai.ru
```

5. Render покажет DNS-записи, которые нужно добавить у регистратора.
6. Откройте DNS-настройки домена у регистратора и добавьте записи из Render.
7. Дождитесь обновления DNS. Обычно это занимает от нескольких минут до 24 часов.
8. В Render включите HTTPS/SSL, если он не включился автоматически.

## Что нельзя публиковать

Никогда не добавляйте в GitHub:

- `.env`
- настоящий `YANDEX_API_KEY`
- другие секретные ключи

Если ключ уже случайно попал в публичный репозиторий, удалите его в Yandex Cloud и создайте новый.
