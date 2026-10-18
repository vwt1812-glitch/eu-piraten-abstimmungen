// Erkennt echte Bilddateien an den ersten Bytes – eine Fehler- oder Sperrseite (HTML) darf nicht als Foto landen.
export function bildformat(daten) {
  const b = Buffer.from(daten);
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

// Kurze Beschreibung, was statt eines Bildes kam – für das Protokoll.
export function keinBild(daten, contentType) {
  const anfang = Buffer.from(daten).subarray(0, 60).toString("utf8").replace(/\s+/g, " ").trim();
  return `${contentType || "ohne Content-Type"}, ${Buffer.from(daten).length} Bytes, beginnt mit „${anfang}“`;
}

// Lädt ein Bild mit einem echten Browser (Playwright-Kontext): Bot-Abwehrseiten, die erst per JavaScript
// ein Cookie setzen und neu laden, werden so bestanden. Gibt die Bilddaten oder null zurück.
export async function imBrowserLaden(kontext, url, { timeout = 30000 } = {}) {
  const page = await kontext.newPage();
  try {
    const hauptseite = (r) => r.request().isNavigationRequest() && r.frame() === page.mainFrame();
    const bild = page
      .waitForResponse((r) => hauptseite(r) && r.ok() && /^image\//.test(r.headers()["content-type"] ?? ""), { timeout })
      .then((r) => r.body())
      .catch(() => null);
    await page.goto(url, { timeout }).catch(() => {});
    let daten = await bild;
    if (!daten || !bildformat(daten)) {
      // Die Prüfung ist bestanden, aber das Bild kam nicht als Seite – mit den Cookies des Kontexts noch einmal.
      const res = await kontext.request.get(url, { timeout }).catch(() => null);
      daten = res?.ok() ? await res.body() : null;
    }
    return daten && bildformat(daten) ? Buffer.from(daten) : null;
  } finally {
    await page.close();
  }
}

// Kopfzeile wie ein normales Chrome – „HeadlessChrome“ wird von Bot-Abwehren oft direkt abgewiesen.
export function browserKennung(version, arch = process.arch) {
  return `Mozilla/5.0 (X11; Linux ${arch === "arm64" ? "aarch64" : "x86_64"}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}
