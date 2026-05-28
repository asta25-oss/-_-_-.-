import express from "express";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const YANDEX_API_URL = "https://llm.api.cloud.yandex.net";
const OPENAI_IMAGE_API_URL = "https://api.openai.com/v1/images/generations";
const REPLICATE_API_URL = "https://api.replicate.com/v1";

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const productLabels = {
  tshirt: "футболка",
  hoodie: "худи",
  sweatshirt: "свитшот",
  mug: "кружка",
  shopper: "шоппер",
  cap: "кепка"
};

const templateLabels = {
  classic: "классический",
  oversized: "оверсайз",
  premium: "премиальный",
  sport: "спортивный",
  ceramic: "классическая керамика",
  thermo: "термокружка",
  enamel: "эмалированная кружка",
  tall: "высокая кружка",
  canvas: "плотный канвас",
  eco: "натуральная ткань",
  fivePanel: "пятипанельная",
  baseball: "бейсболка"
};

const printTypePresets = {
  sticker: "flat vector sticker, bold contour, single centered motif",
  icon: "minimal flat icon, clean silhouette, one simple symbol",
  mascot: "friendly mascot character as a sticker illustration, no humans, no realistic body",
  pattern: "decorative motif, compact repeatable pattern tile",
  abstract: "abstract geometric emblem, playful shapes, clean vector composition",
  badge: "round badge emblem, central pictogram, no typography"
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

const badBriefFragments = [
  /с\s+надписью\s+[^,.]+/gi,
  /надпись\s+[^,.]+/gi,
  /текст\s+[^,.]+/gi,
  /логотип[а-яё]*|лого/gi,
  /на\s+спине|на\s+груди|спереди|сзади|слева|справа/gi,
  /футболк[аеиуой]*|худи|свитшот[а-яё]*|кружк[аеиуой]*|шоппер[а-яё]*|кепк[аеиуой]*/gi,
  /товар[а-яё]*|мерч[а-яё]*|мокап[а-яё]*|одежд[а-яё]*|ткан[а-яё]*/gi,
  /мужик[а-яё]*|мужчин[а-яё]*|женщин[а-яё]*|человек[а-яё]*|люд[а-яё]*|модель[а-яё]*|сотрудник[а-яё]*|команд[а-яё]*/gi,
  /департамент[а-яё]*|отдел[а-яё]*|компани[а-яё]*|корпоратив[а-яё]*/gi
];

const ideaHints = [
  { test: /празд|вечерин|развлеч|весел|радост|celebrat|party/i, value: "confetti, sparkles, party popper, festive abstract shapes" },
  { test: /айти|it|код|разраб|дедлайн|програм|dev/i, value: "pixel spark, cursor arrow, code brackets as abstract shapes, tech symbol" },
  { test: /кофе|кафе|coffee/i, value: "coffee bean, steam swirl, cozy icon" },
  { test: /спорт|футбол|баскет|бег|sport/i, value: "dynamic ball trail, motion lines, sporty emblem" },
  { test: /кот|кошка|cat/i, value: "stylized cat mascot head, playful sticker" },
  { test: /космос|space|звезд|ракета|планет/i, value: "planet, stars, comet, rocket silhouette" },
  { test: /эко|природ|лес|лист|green|зел/i, value: "leaf, sprout, nature emblem, organic shapes" },
  { test: /музык|music|звук/i, value: "sound wave, note-like abstract shapes, rhythm emblem" }
];

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

function cleanString(value, maxLength = 1200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function truncateUtf8(value, maxBytes = 480) {
  let text = value;

  while (Buffer.byteLength(text, "utf8") > maxBytes) {
    text = text.slice(0, -1);
  }

  return text.trim();
}

function normalizeInput(body) {
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
    targetView: targetView === "back" ? "back" : "front",
    selectedVariant: Number.isInteger(Number(body?.selectedVariant))
      ? Number(body.selectedVariant)
      : 0
  };

  if (!input.product) throw new Error("Выберите тип мерча.");
  if (!input.template) throw new Error("Выберите шаблон.");
  if (!input.color) throw new Error("Выберите цвет основы.");
  if (!palettePresets[input.palette]) input.palette = "premium";
  if (!input.brief) throw new Error("Опишите задачу для мерча.");

  return input;
}

function label(dictionary, key) {
  return dictionary[key] || key;
}

function pickSideBrief(brief, targetView) {
  const sideWords = targetView === "back"
    ? ["спин", "сзади", "назад", "зад"]
    : ["груд", "спереди", "перед", "фронт"];
  const oppositeWords = targetView === "back"
    ? ["груд", "спереди", "перед", "фронт"]
    : ["спин", "сзади", "назад", "зад"];
  const chunks = brief
    .split(/[.;\n,]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const sideChunks = chunks.filter((chunk) => {
    const lower = chunk.toLowerCase();
    return sideWords.some((word) => lower.includes(word));
  });
  const neutralChunks = chunks.filter((chunk) => {
    const lower = chunk.toLowerCase();
    return !oppositeWords.some((word) => lower.includes(word));
  });

  return (sideChunks.length ? sideChunks : neutralChunks).join(", ") || brief;
}

function sanitizePrintBrief(brief) {
  return badBriefFragments
    .reduce((text, pattern) => text.replace(pattern, " "), brief)
    .replace(/["«»]/g, " ")
    .replace(/[A-ZА-ЯЁ]{2,}\s*\d*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCleanPrintIdea(input) {
  const sideBrief = pickSideBrief(input.brief, input.targetView);
  const combined = [sideBrief, input.refinement].filter(Boolean).join(". ");
  const cleaned = sanitizePrintBrief(combined);
  const hints = ideaHints
    .filter(({ test }) => test.test(combined))
    .map(({ value }) => value);

  if (cleaned && hints.length) return cleaned + "; " + hints.join(", ");
  if (cleaned) return cleaned;
  if (hints.length) return hints.join(", ");
  return "abstract brand-friendly symbol, clean playful graphic mark";
}

function buildVisualBrief(input) {
  const text = [pickSideBrief(input.brief, input.targetView), input.refinement]
    .filter(Boolean)
    .join(" ");
  const parts = visualBriefRules
    .filter(({ test }) => test.test(text))
    .flatMap(({ parts: nextParts }) => nextParts);
  const uniqueParts = [...new Set(parts)].slice(0, 7);

  if (uniqueParts.length) {
    return uniqueParts.join(", ");
  }

  return "simple abstract brand symbol, clean geometric mark, friendly emblem";
}

function buildPrintPrompt(input, variant, maxBytes = 480) {
  const printIdea = buildVisualBrief(input);
  const sideName = input.targetView === "back" ? "BACK" : "FRONT";
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
    "Motifs: " + printIdea + ".",
    uploaded,
    "No product, clothing, bag, mug, cup, bottle, thermos, jar, fabric.",
    "No people, photo, text, letters, numbers, logo, watermark."
  ].filter(Boolean).join(" ");

  const finalPrompt = truncateUtf8(prompt, maxBytes);
  if (process.env.DEBUG_PROMPTS === "true") {
    console.log(`[${sideName}] ${Buffer.byteLength(finalPrompt, "utf8")} bytes: ${finalPrompt}`);
  }

  return finalPrompt;
}

function yandexHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Api-Key ${process.env.YANDEX_API_KEY}`
  };
}

function imageProvider() {
  const provider = cleanString(process.env.IMAGE_PROVIDER, 30).toLowerCase();
  return ["openai", "replicate"].includes(provider) ? provider : "yandex";
}

function providerIsConfigured(provider) {
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (provider === "replicate") return Boolean(process.env.REPLICATE_API_TOKEN);
  return Boolean(process.env.YANDEX_API_KEY && process.env.YANDEX_FOLDER_ID);
}

async function imageUrlToDataUrl(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Не удалось загрузить изображение провайдера: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

async function getImageOperation(operationId) {
  const response = await fetch(`${YANDEX_API_URL}/operations/${operationId}`, {
    headers: yandexHeaders()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка проверки изображения YandexART: ${errorText}`);
  }

  return response.json();
}

async function startYandexPrintOperation(input, variant = 0) {
  const response = await fetch(`${YANDEX_API_URL}/foundationModels/v1/imageGenerationAsync`, {
    method: "POST",
    headers: yandexHeaders(),
    body: JSON.stringify({
      modelUri: `art://${process.env.YANDEX_FOLDER_ID}/yandex-art/latest`,
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
    const errorText = await response.text();
    throw new Error(`Ошибка YandexART: ${errorText}`);
  }

  const operation = await response.json();
  if (!operation.id) {
    throw new Error("YandexART не вернул идентификатор операции.");
  }

  return operation.id;
}

async function startYandexPrintJobs(input, count = 3) {
  const jobs = [];
  const errors = [];
  const maxAttempts = count + 3;

  for (let attempt = 0; attempt < maxAttempts && jobs.length < count; attempt += 1) {
    try {
      jobs.push({
        title: `Вариант ${jobs.length + 1}`,
        operationId: await startYandexPrintOperation(input, attempt)
      });
    } catch (error) {
      errors.push(`Попытка ${attempt + 1}: ${error.message}`);
    }
  }

  return { jobs, errors };
}

async function generatePrint(input, variant = 0) {
  if (imageProvider() === "openai") {
    return generatePrintOpenAI(input, variant);
  }

  if (imageProvider() === "replicate") {
    return generatePrintReplicate(input, variant);
  }

  const response = await fetch(`${YANDEX_API_URL}/foundationModels/v1/imageGenerationAsync`, {
    method: "POST",
    headers: yandexHeaders(),
    body: JSON.stringify({
      modelUri: `art://${process.env.YANDEX_FOLDER_ID}/yandex-art/latest`,
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
    const errorText = await response.text();
    throw new Error(`Ошибка YandexART: ${errorText}`);
  }

  let operation = await response.json();
  const operationId = operation.id;

  if (!operationId) {
    throw new Error("YandexART не вернул идентификатор операции.");
  }

  for (let attempt = 0; attempt < 18; attempt += 1) {
    if (operation.done) {
      if (operation.error) {
        throw new Error(`Ошибка генерации изображения YandexART: ${operation.error.message || JSON.stringify(operation.error)}`);
      }

      const image = operation?.response?.image;
      if (!image) {
        throw new Error("YandexART завершил операцию, но не вернул изображение.");
      }

      return `data:image/jpeg;base64,${image}`;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    operation = await getImageOperation(operationId);
  }

  throw new Error("YandexART не успел подготовить изображение за 90 секунд. Попробуйте повторить запрос.");
}

async function generatePrintOpenAI(input, variant = 0) {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const body = {
    model,
    prompt: buildPrintPrompt(input, variant, 1800),
    size: process.env.OPENAI_IMAGE_SIZE || "1024x1024",
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
    output_format: process.env.OPENAI_IMAGE_FORMAT || "png",
    background: process.env.OPENAI_IMAGE_BACKGROUND || "transparent"
  };

  const response = await fetch(OPENAI_IMAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка OpenAI Image API: ${errorText}`);
  }

  const json = await response.json();
  const image = json?.data?.[0]?.b64_json;
  const url = json?.data?.[0]?.url;

  if (image) return `data:image/png;base64,${image}`;
  if (url) return imageUrlToDataUrl(url);

  throw new Error("OpenAI Image API не вернул изображение.");
}

async function generatePrintReplicate(input, variant = 0) {
  const model = cleanString(process.env.REPLICATE_IMAGE_MODEL, 120) || "black-forest-labs/flux-schnell";
  const response = await fetch(`${REPLICATE_API_URL}/models/${model}/predictions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "wait",
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`
    },
    body: JSON.stringify({
      input: {
        prompt: buildPrintPrompt(input, variant, 1800),
        aspect_ratio: "1:1",
        output_format: "png",
        num_outputs: 1,
        seed: Date.now() + variant
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка Replicate: ${errorText}`);
  }

  let prediction = await response.json();

  for (let attempt = 0; attempt < 24 && !["succeeded", "failed", "canceled"].includes(prediction.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const pollResponse = await fetch(prediction.urls.get, {
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`
      }
    });

    if (!pollResponse.ok) {
      const errorText = await pollResponse.text();
      throw new Error(`Ошибка проверки Replicate: ${errorText}`);
    }

    prediction = await pollResponse.json();
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate не завершил генерацию: ${prediction.error || prediction.status}`);
  }

  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!output) throw new Error("Replicate не вернул изображение.");

  return imageUrlToDataUrl(output);
}

async function generatePrintWithRetry(input, variant, retries = 1) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await generatePrint(input, variant + attempt * 100);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }

  throw lastError;
}

async function generatePrintVariants(input, count = 3) {
  const variants = [];
  const errors = [];
  const maxAttempts = count + 3;

  for (let attempt = 0; attempt < maxAttempts && variants.length < count; attempt += 1) {
    try {
      const variantIndex = variants.length;
      variants.push({
        title: `Вариант ${variantIndex + 1}`,
        printImage: await generatePrintWithRetry(input, attempt, 1)
      });
    } catch (error) {
      errors.push(`Попытка ${attempt + 1}: ${error.message}`);
    }
  }

  return { variants, errors };
}

function buildDemoVariants(input) {
  return [0, 1, 2].map((index) => ({
    title: `Демо-вариант ${index + 1}`,
    printImage: "/assets/merchai-logo.jpg",
    demo: true
  }));
}

function buildGenerationError(provider, errors) {
  if (!errors.length) return undefined;

  const providerName = provider === "openai"
    ? "OpenAI Image API"
    : provider === "replicate"
      ? "Replicate"
      : "YandexART";
  return [
    `${providerName} не смог подготовить все 3 варианта. Повторите генерацию, если нужен полный набор.`,
    "Диагностика:",
    errors.join("\n")
  ].join("\n");
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/generate-start", async (req, res) => {
  try {
    const input = normalizeInput(req.body);
    const provider = imageProvider();

    if (provider !== "yandex") {
      return res.status(400).json({
        message: "Асинхронный Cloudflare-режим сейчас поддерживает IMAGE_PROVIDER=yandex."
      });
    }

    if (!providerIsConfigured(provider)) {
      return res.json({
        demo: true,
        variants: buildDemoVariants(input),
        imageError: "На сервере не заполнены YANDEX_API_KEY и/или YANDEX_FOLDER_ID. Показаны демо-варианты."
      });
    }

    const { jobs, errors } = await startYandexPrintJobs(input, 3);
    if (!jobs.length) {
      return res.json({
        demo: true,
        variants: buildDemoVariants(input),
        imageError: buildGenerationError(provider, errors)
      });
    }

    res.json({ jobs, imageError: errors.length ? errors.join("\n") : undefined });
  } catch (error) {
    res.status(400).json({
      message: `Ошибка запуска генерации: ${error.message}`
    });
  }
});

app.post("/api/generate-status", async (req, res) => {
  try {
    const jobs = Array.isArray(req.body?.jobs) ? req.body.jobs : [];
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
        const operation = await getImageOperation(operationId);
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

    res.json({
      done: pending.length === 0,
      pending,
      variants,
      imageError: errors.length ? errors.join("\n") : undefined
    });
  } catch (error) {
    res.status(400).json({
      message: `Ошибка проверки генерации: ${error.message}`
    });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const input = normalizeInput(req.body);
    const provider = imageProvider();

    if (!providerIsConfigured(provider)) {
      return res.json({
        demo: true,
        variants: buildDemoVariants(input),
        imageError: provider === "openai"
          ? "На сервере не заполнен OPENAI_API_KEY. Показаны демо-варианты."
          : provider === "replicate"
            ? "На сервере не заполнен REPLICATE_API_TOKEN. Показаны демо-варианты."
          : "На сервере не заполнены YANDEX_API_KEY и/или YANDEX_FOLDER_ID. Показаны демо-варианты."
      });
    }

    const { variants, errors } = await generatePrintVariants(input, 3);
    const hasGeneratedImages = variants.length > 0;
    const hasAllVariants = variants.length >= 3;
    if (errors.length) console.warn("Image generation errors:", errors);

    res.json({
      variants: hasGeneratedImages ? variants : buildDemoVariants(input),
      imageError: !hasAllVariants && errors.length
          ? buildGenerationError(provider, errors)
          : undefined,
      demo: !hasGeneratedImages
    });
  } catch (error) {
    res.status(400).json({
      message: `Ошибка серверной части: ${error.message}`
    });
  }
});

app.post("/api/regenerate", async (req, res) => {
  try {
    const input = normalizeInput(req.body);
    const provider = imageProvider();

    if (!input.refinement) {
      return res.status(400).json({
        message: "Опишите, что нужно изменить в выбранном варианте."
      });
    }

    if (!providerIsConfigured(provider)) {
      return res.json({
        demo: true,
        variants: buildDemoVariants(input),
        imageError: provider === "openai"
          ? "На сервере не заполнен OPENAI_API_KEY. Показаны демо-варианты."
          : provider === "replicate"
            ? "На сервере не заполнен REPLICATE_API_TOKEN. Показаны демо-варианты."
          : "На сервере не заполнены YANDEX_API_KEY и/или YANDEX_FOLDER_ID. Показаны демо-варианты."
      });
    }

    const { variants, errors } = await generatePrintVariants(input, 3);
    const hasGeneratedImages = variants.length > 0;
    const hasAllVariants = variants.length >= 3;
    if (errors.length) console.warn("Image regeneration errors:", errors);

    res.json({
      variants: hasGeneratedImages ? variants : buildDemoVariants(input),
      imageError: !hasAllVariants && errors.length
          ? buildGenerationError(provider, errors)
          : undefined,
      demo: !hasGeneratedImages
    });
  } catch (error) {
    res.status(400).json({
      message: `Ошибка серверной части: ${error.message}`
    });
  }
});

async function savePreviewImage(dataUrl, ordersDir) {
  const match = /^data:image\/png;base64,([a-z0-9+/=]+)$/i.exec(cleanString(dataUrl, 8_000_000));
  if (!match) return "";

  const filename = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  await fs.writeFile(path.join(ordersDir, filename), Buffer.from(match[1], "base64"));
  return path.join("orders", filename);
}

app.post("/api/order", async (req, res) => {
  try {
    const ordersDir = path.join(__dirname, "orders");
    await fs.mkdir(ordersDir, { recursive: true });

    const order = {
      createdAt: new Date().toISOString(),
      product: cleanString(req.body?.product, 80),
      template: cleanString(req.body?.template, 80),
      color: cleanString(req.body?.color, 80),
      palette: cleanString(req.body?.palette, 40),
      brief: cleanString(req.body?.brief, 1800),
      variantTitle: cleanString(req.body?.variantTitle, 120),
      contactName: cleanString(req.body?.contactName, 120),
      company: cleanString(req.body?.company, 160),
      contact: cleanString(req.body?.contact, 180),
      quantity: cleanString(req.body?.quantity, 80),
      sizes: cleanString(req.body?.sizes, 600),
      comment: cleanString(req.body?.comment, 1000),
      printSettings: req.body?.printSettings
        ? JSON.stringify(req.body.printSettings).slice(0, 600)
        : "",
      textSettings: req.body?.textSettings
        ? JSON.stringify(req.body.textSettings).slice(0, 600)
        : "",
      previewView: cleanString(req.body?.previewView, 20),
      previewImagePath: await savePreviewImage(req.body?.previewImage, ordersDir)
    };

    if (!order.contactName || !order.contact || !order.quantity) {
      return res.status(400).json({
        message: "Заполните имя, контакт и количество."
      });
    }

    await fs.appendFile(
      path.join(ordersDir, "orders.jsonl"),
      `${JSON.stringify(order)}\n`,
      "utf8"
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({
      message: `Не удалось сохранить заявку: ${error.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`MerchAI started: http://localhost:${PORT}`);
});
