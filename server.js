import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const YANDEX_API_URL = "https://llm.api.cloud.yandex.net";

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const requiredFields = ["item", "goal", "style", "colors", "company", "brief", "material"];

function normalizeInput(body) {
  const normalized = {};

  for (const field of requiredFields) {
    const value = typeof body?.[field] === "string" ? body[field].trim() : "";

    if (!value) {
      throw new Error(`Не заполнено поле: ${field}`);
    }

    normalized[field] = value.slice(0, 1200);
  }

  normalized.printPrompt = typeof body?.printPrompt === "string"
    ? body.printPrompt.trim().slice(0, 500)
    : "";
  normalized.sourceReference = typeof body?.sourceReference === "string"
    ? body.sourceReference.trim().slice(0, 500)
    : "";
  normalized.refinement = typeof body?.refinement === "string"
    ? body.refinement.trim().slice(0, 500)
    : "";
  normalized.selectedVariant = Number.isInteger(Number(body?.selectedVariant))
    ? Number(body.selectedVariant)
    : 0;

  return normalized;
}

function buildPrompt({ item, goal, style, colors, company, brief, material, printPrompt, sourceReference, refinement }) {
  return `
Ты — дизайнер-консультант по корпоративному мерчу. Твоя задача — дать короткие дизайнерские и производственные рекомендации после выбора визуальных вариантов.

Данные пользователя:
- Тип мерча: ${item}
- Материал: ${material}
- Цель мерча: ${goal}
- Стиль: ${style}
- Цвета: ${colors}
- Компания / сфера бизнеса: ${company}
- Краткое описание идеи: ${brief}
- Идея принта: ${printPrompt || "не указана"}
- Логотип / изображение из открытых источников: ${sourceReference || "не указано"}
- Доработка выбранного варианта: ${refinement || "не указана"}

Сформируй короткий ответ строго по структуре:
1. Концепция: 2-3 предложения.
2. Цвет и материал: 2-3 практические рекомендации.
3. Принт и композиция: 2-3 рекомендации.
4. Логотипы, картинки и мемы: как безопасно добавить их после выбора варианта; напомни использовать свои материалы или источники с разрешённой лицензией.
5. Что передать дизайнеру: краткий список финальных уточнений.

Не пиши полный промпт для генерации изображения. Не растягивай ответ. Пиши на русском языке и избегай общих фраз.
`;
}

function buildImagePrompt({ item, style, colors, material, printPrompt, sourceReference, refinement, selectedVariant }, variant) {
  const fabric = material === "синтетика"
    ? "гладкая синтетическая ткань, лёгкий спортивный блеск, яркие цвета"
    : "натуральная хлопковая ткань, матовая фактура, мягкая текстура";
  const variantStyle = [
    "основной цвет товара из палитры, небольшой аккуратный принт на груди",
    "контрастные рукава и центральный абстрактный принт",
    "светлая база, цветные акцентные детали и крупный принт"
  ][variant % 3];
  const printIdea = printPrompt
    ? `Идея принта: ${printPrompt}.`
    : "Абстрактный принт из крупных геометрических форм.";
  const reference = sourceReference
    ? `Референс для настроения: ${sourceReference}.`
    : "";
  const revision = refinement
    ? `Доработка выбранного варианта ${selectedVariant + 1}: ${refinement}.`
    : "";
  const prompt = `Студийный mockup: один ${item}, ${fabric}. Палитра ${colors}. ${variantStyle}. Стиль ${style}. ${printIdea} ${reference} ${revision} Светлый фон, мягкий свет. Без букв, без слов, без логотипов, без текста, без водяных знаков.`;

  return prompt.slice(0, 490);
}

function yandexHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Api-Key ${process.env.YANDEX_API_KEY}`
  };
}

async function generateConcept(input) {
  const response = await fetch(`${YANDEX_API_URL}/foundationModels/v1/completion`, {
    method: "POST",
    headers: yandexHeaders(),
    body: JSON.stringify({
      modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt/latest`,
      completionOptions: {
        stream: false,
        temperature: 0.7,
        maxTokens: "1400"
      },
      messages: [
        {
          role: "system",
          text: "Ты помогаешь компаниям создавать концепции изображений для корпоративного мерча."
        },
        {
          role: "user",
          text: buildPrompt(input)
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка YandexGPT: ${errorText}`);
  }

  const data = await response.json();
  return data?.result?.alternatives?.[0]?.message?.text || "YandexGPT вернул пустой ответ.";
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

async function generateImage(input, variant = 0) {
  const response = await fetch(`${YANDEX_API_URL}/foundationModels/v1/imageGenerationAsync`, {
    method: "POST",
    headers: yandexHeaders(),
    body: JSON.stringify({
      modelUri: `art://${process.env.YANDEX_FOLDER_ID}/yandex-art/latest`,
      messages: [
        {
          text: buildImagePrompt(input, variant),
          weight: "1"
        }
      ],
      generationOptions: {
        mimeType: "image/jpeg",
        seed: String(variant + 1),
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

async function generateImageVariants(input, count = 3) {
  const variants = [];
  const errors = [];

  for (let index = 0; index < count; index += 1) {
    try {
      variants.push({
        title: `Вариант ${index + 1}`,
        image: await generateImage(input, index)
      });
    } catch (error) {
      errors.push(`Вариант ${index + 1}: ${error.message}`);
    }
  }

  return { variants, errors };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/generate", async (req, res) => {
  try {
    if (!process.env.YANDEX_API_KEY || !process.env.YANDEX_FOLDER_ID) {
      return res.status(500).json({
        text: "Не заполнены YANDEX_API_KEY и/или YANDEX_FOLDER_ID в файле .env."
      });
    }

    const input = normalizeInput(req.body);
    const text = await generateConcept(input);

    try {
      const { variants, errors } = await generateImageVariants(input, 3);

      res.json({
        text,
        variants,
        image: variants[0]?.image,
        imageError: errors.length ? errors.join("\n") : undefined
      });
    } catch (imageError) {
      res.json({
        text,
        imageError: imageError.message
      });
    }
  } catch (error) {
    res.status(400).json({
      text: `Ошибка серверной части: ${error.message}`
    });
  }
});

app.post("/api/regenerate", async (req, res) => {
  try {
    if (!process.env.YANDEX_API_KEY || !process.env.YANDEX_FOLDER_ID) {
      return res.status(500).json({
        text: "Не заполнены YANDEX_API_KEY и/или YANDEX_FOLDER_ID в файле .env."
      });
    }

    const input = normalizeInput(req.body);

    if (!input.refinement) {
      return res.status(400).json({
        text: "Опишите, что нужно доработать в выбранном варианте."
      });
    }

    const text = await generateConcept(input);
    const { variants, errors } = await generateImageVariants(input, 3);

    res.json({
      text,
      variants,
      image: variants[0]?.image,
      imageError: errors.length ? errors.join("\n") : undefined
    });
  } catch (error) {
    res.status(400).json({
      text: `Ошибка серверной части: ${error.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`Сайт запущен: http://localhost:${PORT}`);
});
