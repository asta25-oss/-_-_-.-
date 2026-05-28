const YANDEX_API_URL = "https://llm.api.cloud.yandex.net";

const printTypePresets = {
  sticker: true,
  icon: true,
  mascot: true,
  pattern: true,
  abstract: true,
  badge: true
};

const palettePresets = {
  coffee: "warm coffee palette: espresso brown, milk foam, caramel, muted cream",
  summer: "fresh summer palette: sky blue, citrus yellow, coral, clean white",
  premium: "premium restrained palette: black, off white, graphite, one metallic accent",
  neon: "tech neon palette: black, acid green, electric blue, white",
  eco: "eco natural palette: forest green, leaf, linen, soft clay",
  berry: "berry palette: burgundy, pink, cream, deep plum",
  monochrome: "monochrome palette: black, white, greyscale, sharp contrast"
};

const visualBriefRules = [
  { test: /кофе|кафе|кофейн|coffee|cafe/i, parts: ["coffee bean", "steam swirl", "warm cafe emblem"] },
  { test: /лети|лет|год|anniversary|юбиле|день рожд|birthday/i, parts: ["anniversary badge", "confetti", "small celebration rays"] },
  { test: /летн|summer|жар|солн/i, parts: ["sun ray", "summer accent", "light playful shapes"] },
  { test: /айти|it|код|разраб|дедлайн|програм|dev/i, parts: ["cursor arrow", "code bracket", "pixel spark"] },
  { test: /спорт|футбол|баскет|бег|sport/i, parts: ["motion line", "sport emblem", "dynamic trail"] },
  { test: /эко|природ|лес|лист|green|зел/i, parts: ["leaf", "sprout", "organic emblem"] },
  { test: /музык|music|звук/i, parts: ["sound wave", "rhythm mark", "music note shape"] },
  { test: /космос|space|звезд|ракет|планет/i, parts: ["planet", "star", "orbit line"] },
  { test: /кот|кошка|cat/i, parts: ["stylized cat head", "playful mascot"] }
];

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export function cleanString(value, maxLength = 1200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function truncateUtf8(value, maxBytes = 480) {
  let text = value;
  const encoder = new TextEncoder();

  while (encoder.encode(text).length > maxBytes) {
    text = text.slice(0, -1);
  }

  return text.trim();
}

export function normalizeInput(body) {
  const targetView = cleanString(body?.targetView || body?.printSettings?.view, 20);
  const printType = cleanString(body?.printType, 30) || "sticker";
  const input = {
    product: cleanString(body?.product, 80),
    template: cleanString(body?.template, 80),
    color: cleanString(body?.color, 80),
    palette: cleanString(body?.palette, 40) || "premium",
    brief: cleanString(body?.brief, 1800),
    printType: printTypePresets[printType] ? printType : "sticker",
    uploadedAssetName: cleanString(body?.uploadedAssetName, 180),
    refinement: cleanString(body?.refinement, 700),
    targetView: targetView === "back" ? "back" : "front"
  };

  if (!input.product) throw new Error("Выберите тип мерча.");
  if (!input.template) throw new Error("Выберите шаблон.");
  if (!input.color) throw new Error("Выберите цвет основы.");
  if (!palettePresets[input.palette]) input.palette = "premium";
  if (!input.brief) throw new Error("Опишите задачу для мерча.");

  return input;
}

function pickSideBrief(brief, targetView) {
  const oppositeWords = targetView === "back"
    ? ["груд", "спереди", "перед", "фронт"]
    : ["спин", "сзади", "назад", "зад"];
  const chunks = brief
    .split(/[.;\n,]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const neutralChunks = chunks.filter((chunk) => {
    const lower = chunk.toLowerCase();
    return !oppositeWords.some((word) => lower.includes(word));
  });

  return neutralChunks.join(", ") || brief;
}

function buildVisualBrief(input) {
  const text = [pickSideBrief(input.brief, input.targetView), input.refinement]
    .filter(Boolean)
    .join(" ");
  const parts = visualBriefRules
    .filter(({ test }) => test.test(text))
    .flatMap(({ parts: nextParts }) => nextParts);
  const uniqueParts = [...new Set(parts)].slice(0, 7);

  return uniqueParts.length
    ? uniqueParts.join(", ")
    : "simple abstract brand symbol, clean geometric mark, friendly emblem";
}

export function buildPrintPrompt(input, variant, maxBytes = 480) {
  const variantDirections = [
    "single clean vector emblem, one central symbol",
    "bold sticker icon, thick outline, high contrast",
    "minimal pictogram badge, generous white space"
  ];
  const uploaded = input.uploadedAssetName ? "Do not redraw uploaded logo." : "";
  const prompt = [
    "Isolated merch print graphic, not a mockup.",
    "One centered flat vector sticker on white background.",
    "Simple brand emblem, clean silhouette, no scene.",
    palettePresets[input.palette] + ".",
    variantDirections[variant % variantDirections.length] + ".",
    "Motifs: " + buildVisualBrief(input) + ".",
    uploaded,
    "No product, clothing, bag, mug, cup, bottle, thermos, jar, fabric.",
    "No people, photo, text, letters, numbers, logo, watermark."
  ].filter(Boolean).join(" ");

  return truncateUtf8(prompt, maxBytes);
}

function yandexHeaders(env) {
  return {
    "Content-Type": "application/json",
    Authorization: `Api-Key ${env.YANDEX_API_KEY}`
  };
}

export function yandexConfigured(env) {
  return Boolean(env.YANDEX_API_KEY && env.YANDEX_FOLDER_ID);
}

export function buildDemoVariants() {
  return [0, 1, 2].map((index) => ({
    title: `Демо-вариант ${index + 1}`,
    printImage: "/assets/merchai-logo.jpg",
    demo: true
  }));
}

export async function startYandexPrintOperation(env, input, variant = 0) {
  const response = await fetch(`${YANDEX_API_URL}/foundationModels/v1/imageGenerationAsync`, {
    method: "POST",
    headers: yandexHeaders(env),
    body: JSON.stringify({
      modelUri: `art://${env.YANDEX_FOLDER_ID}/yandex-art/latest`,
      messages: [
        {
          text: buildPrintPrompt(input, variant, 480),
          weight: "1"
        }
      ],
      generationOptions: {
        mimeType: "image/jpeg",
        seed: String(Date.now() + variant),
        aspectRatio: {
          widthRatio: "1",
          heightRatio: "1"
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ошибка YandexART: ${await response.text()}`);
  }

  const operation = await response.json();
  if (!operation.id) throw new Error("YandexART не вернул идентификатор операции.");
  return operation.id;
}

export async function startYandexPrintJobs(env, input, count = 3) {
  const jobs = [];
  const errors = [];
  const maxAttempts = count + 3;

  for (let attempt = 0; attempt < maxAttempts && jobs.length < count; attempt += 1) {
    try {
      jobs.push({
        title: `Вариант ${jobs.length + 1}`,
        operationId: await startYandexPrintOperation(env, input, attempt)
      });
    } catch (error) {
      errors.push(`Попытка ${attempt + 1}: ${error.message}`);
    }
  }

  return { jobs, errors };
}

export async function getYandexOperation(env, operationId) {
  const response = await fetch(`${YANDEX_API_URL}/operations/${operationId}`, {
    headers: yandexHeaders(env)
  });

  if (!response.ok) {
    throw new Error(`Ошибка проверки изображения YandexART: ${await response.text()}`);
  }

  return response.json();
}
