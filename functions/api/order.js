import { cleanString, json } from "../_shared/merch.js";

export async function onRequestPost({ request }) {
  try {
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
  } catch (error) {
    return json({ message: `Не удалось принять заявку: ${error.message}` }, 500);
  }
}
