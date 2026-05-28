import { json } from "../_shared/merch.js";

export function onRequestGet() {
  return json({ ok: true, runtime: "cloudflare-pages" });
}
