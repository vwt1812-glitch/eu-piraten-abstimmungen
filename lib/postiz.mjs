// Postiz Public API (selbst gehostet: <Adresse>/api/public/v1).
// Quelle: apps/backend/src/public-api/routes/v1/public.integrations.controller.ts in gitroomhq/postiz-app.

export function apiBasis(url) {
  const ohne = url.replace(/\/+$/, "");
  if (/\/public\/v1$/.test(ohne)) return ohne;
  if (/\/api$/.test(ohne)) return `${ohne}/public/v1`;
  return `${ohne}/api/public/v1`;
}

export function postizClient({ url, apiKey, fetch = globalThis.fetch }) {
  const basis = apiBasis(url);
  // Postiz begrenzt die Public API pro Stunde (API_LIMIT, Standard 30) – mitzählen.
  let anfragen = 0;

  async function anfrage(pfad, optionen = {}) {
    anfragen++;
    const res = await fetch(basis + pfad, {
      ...optionen,
      // Postiz erwartet den Key ohne „Bearer“.
      headers: { Authorization: apiKey, ...optionen.headers },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Postiz ${optionen.method ?? "GET"} ${pfad}: HTTP ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }

  return {
    get anfragen() { return anfragen; },

    kanaele: () => anfrage("/integrations"),

    // Posts mit Termin im Zeitraum, samt state (QUEUE, PUBLISHED, ERROR, DRAFT) und error.
    posts: ({ startDate, endDate }) => anfrage(`/posts?${new URLSearchParams({ startDate, endDate })}`).then((r) => r.posts ?? []),

    // Gibt { id, path } zurück – genau das erwartet Postiz später als Bild im Post.
    async hochladen(daten, dateiname, typ = "image/png") {
      const form = new FormData();
      form.append("file", new Blob([daten], { type: typ }), dateiname);
      return anfrage("/upload", { method: "POST", body: form });
    },

    beitragAnlegen: (body) =>
      anfrage("/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}
