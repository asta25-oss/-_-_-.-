import { cleanString, getYandexOperation, json, yandexConfigured } from "../_shared/merch.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!yandexConfigured(env)) {
      return json({ message: "В Cloudflare не заполнены YANDEX_API_KEY и/или YANDEX_FOLDER_ID." }, 400);
    }

    const body = await request.json();
    const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
    const variants = [];
    const pending = [];
    const errors = [];

    for (const job of jobs) {
      const operationId = cleanString(job?.operationId, 200);
      const title = cleanString(job?.title, 80) || `Вариант ${variants.length + pending.length + 1}`;

      if (!operationId) {
        errors.push(`${title}: нет идентификатора операции.`);
        continue;
      }

      try {
        const operation = await getYandexOperation(env, operationId);

        if (!operation.done) {
          pending.push({ title, operationId });
          continue;
        }

        if (operation.error) {
          errors.push(`${title}: ${operation.error.message || JSON.stringify(operation.error)}`);
          continue;
        }

        const image = operation?.response?.image;
        if (!image) {
          errors.push(`${title}: YandexART завершил операцию, но не вернул изображение.`);
          continue;
        }

        variants.push({ title, printImage: `data:image/jpeg;base64,${image}` });
      } catch (error) {
        errors.push(`${title}: ${error.message}`);
      }
    }

    return json({
      done: pending.length === 0,
      pending,
      variants,
      imageError: errors.length ? errors.join("\n") : undefined
    });
  } catch (error) {
    return json({ message: `Ошибка проверки генерации: ${error.message}` }, 400);
  }
}
