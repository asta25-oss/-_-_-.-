import {
  buildDemoVariants,
  json,
  normalizeInput,
  startYandexPrintJobs,
  yandexConfigured
} from "../_shared/merch.js";

export async function onRequestPost({ request, env }) {
  try {
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
  } catch (error) {
    return json({ message: `Ошибка запуска генерации: ${error.message}` }, 400);
  }
}
