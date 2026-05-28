import {
  buildDemoVariants,
  cleanString,
  getYandexOperation,
  json,
  normalizeInput,
  startYandexPrintJobs,
  yandexConfigured
} from "./functions/_shared/merch.js";

async function handleGenerateStart(request, env) {
  const input = normalizeInput(await request.json());

  if (!yandexConfigured(env)) {
    return json({
      demo: true,
      variants: buildDemoVariants(),
      imageError: "В Cloudflare не заполнены YANDEX_API_KEY и/или YANDEX_FOLDER_ID. Показаны демо-варианты."
    });
  }

  const { jobs, errors } = await startYandexPrintJobs(env, input, 3);

  if (!jobs.length) {
    return json({
      demo: true,
      variants: buildDemoVariants(),
      imageError: [
        "YandexART не смог запустить генерацию. Показаны демо-варианты.",
        errors.join("\n")
      ].filter(Boolean).join("\n")
    });
  }

  return json({
    jobs,
    imageError: errors.length ? errors.join("\n") : undefined
  });
}

async function handleGenerateStatus(request, env) {
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
}

async function handleOrder(request) {
  const body = await request.json();
  const contactName = cleanString(body?.contactName, 120);
  const contact = cleanString(body?.contact, 180);
  const quantity = cleanString(body?.quantity, 80);

  if (!contactName || !contact || !quantity) {
    return json({ message: "Заполните имя, контакт и количество." }, 400);
  }

  return json({
    ok: true,
    message: "Заявка принята в демо-режиме Cloudflare. Для боевого режима подключите Email, Telegram, CRM или базу данных."
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, runtime: "cloudflare-worker" });
      }

      if (request.method === "POST" && url.pathname === "/api/generate-start") {
        return handleGenerateStart(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/generate-status") {
        return handleGenerateStatus(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/order") {
        return handleOrder(request);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ message: error.message || "Ошибка Cloudflare Worker." }, 500);
    }
  }
};
