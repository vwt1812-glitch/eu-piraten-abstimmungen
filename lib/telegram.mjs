// Telegram Bot API (https://core.telegram.org/bots/api) – nur was die Freigabe braucht.

export function telegramClient({ token, fetch = globalThis.fetch }) {
  async function api(methode, body) {
    const istForm = body instanceof FormData;
    const res = await fetch(`https://api.telegram.org/bot${token}/${methode}`, {
      method: "POST",
      headers: istForm ? undefined : { "Content-Type": "application/json" },
      body: istForm ? body : JSON.stringify(body),
    });
    const daten = await res.json().catch(() => ({}));
    if (!daten.ok) throw new Error(`Telegram ${methode}: ${daten.description ?? `HTTP ${res.status}`}`);
    return daten.result;
  }

  return {
    // timeout > 0: Long Polling – Telegram hält die Anfrage offen, bis etwas kommt.
    updates: (offset, timeout = 0) => api("getUpdates", { offset, timeout, allowed_updates: ["message", "callback_query"] }),

    nachricht: (chatId, text, extra = {}) => api("sendMessage", { chat_id: chatId, text, ...extra }),

    // bilder: [{ daten: Buffer, name }]; gibt die gesendeten Nachrichten zurück.
    async bilder(chatId, bilder) {
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("media", JSON.stringify(bilder.map((_, i) => ({ type: "photo", media: `attach://bild${i}` }))));
      bilder.forEach((b, i) => form.append(`bild${i}`, new Blob([b.daten], { type: "image/png" }), b.name));
      return api("sendMediaGroup", form);
    },

    callbackBeantworten: (id, text) => api("answerCallbackQuery", { callback_query_id: id, text }),

    knoepfeEntfernen: (chatId, nachrichtId) =>
      api("editMessageReplyMarkup", { chat_id: chatId, message_id: nachrichtId, reply_markup: { inline_keyboard: [] } }),
  };
}
