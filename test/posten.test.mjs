import { test } from "node:test";
import assert from "node:assert/strict";
import { auswahl } from "../lib/auswahl.mjs";
import { beitrag, story, alsHtml, unterstuetzt, alternativtexte } from "../lib/beitrag.mjs";
import { apiBasis, postizClient } from "../lib/postiz.mjs";

const JETZT = new Date("2026-10-18T12:00:00Z");

function abstimmung(id, tag, status = "automatisch", position = "FOR") {
  return {
    id,
    zeitpunkt: `2026-10-${String(tag).padStart(2, "0")} 12:00:00`,
    titel: `Abstimmung ${id} & mehr`,
    ergebnis: "ADOPTED",
    deutschland: [{ partei: "CDU", mehrheit: "FOR" }, { partei: "AfD", mehrheit: "AGAINST" }],
    piraten: { position, quelle: "referenz", status },
  };
}

test("Auswahl: neueste zuerst, Limit pro Tag, Prüffälle als Entwurf", () => {
  const liste = [1, 2, 3, 4, 5].map((i) => abstimmung(i, 10 + i)).concat(abstimmung(9, 16, "pruefen"));
  const r = auswahl(liste, {}, { jetzt: JETZT, proTag: 3 });
  assert.deepEqual(r.posten.map((a) => a.id), [5, 4, 3]);
  assert.deepEqual(r.entwuerfe.map((a) => a.id), [9]);
});

test("Auswahl: bereits Gepostetes, alte Abstimmungen und fehlende Position fallen weg", () => {
  const liste = [abstimmung(1, 17), abstimmung(2, 17), abstimmung(3, 17, "keine_position", null)];
  liste.push({ ...abstimmung(4, 1), zeitpunkt: "2026-09-01 12:00:00" });
  const r = auswahl(liste, { 1: { typ: "schedule", zeitpunkt: "2026-10-01T00:00:00Z" } }, { jetzt: JETZT });
  assert.deepEqual(r.posten.map((a) => a.id), [2]);
});

test("Auswahl: rollierende Limits zählen nur echte Posts, keine Entwürfe", () => {
  const gepostet = {
    10: { typ: "schedule", zeitpunkt: "2026-10-18T08:00:00Z" },
    11: { typ: "schedule", zeitpunkt: "2026-10-18T06:00:00Z" },
    12: { typ: "draft", zeitpunkt: "2026-10-18T07:00:00Z" },
    13: { typ: "schedule", zeitpunkt: "2026-10-14T07:00:00Z" },
  };
  const liste = [1, 2, 3].map((i) => abstimmung(i, 17));
  assert.equal(auswahl(liste, gepostet, { jetzt: JETZT, proTag: 3 }).posten.length, 1);
  assert.equal(auswahl(liste, gepostet, { jetzt: JETZT, proTag: 9, proWoche: 4 }).posten.length, 1);
});

test("Auswahl: ohne deutschen Titel wird nicht gepostet", () => {
  const liste = [abstimmung(1, 17), abstimmung(2, 17, "pruefen")];
  const r = auswahl(liste, {}, { jetzt: JETZT, hatTitel: (a) => a.id === 1 });
  assert.deepEqual(r.posten.map((a) => a.id), [1]);
  assert.deepEqual(r.entwuerfe, []);
  assert.deepEqual(r.ohneTitel.map((a) => a.id), [2]);
});

test("Beitrag: Zeilen als Absätze, HTML escapt", () => {
  assert.equal(alsHtml("a & b\n\n<c>"), "<p>a &amp; b</p><p></p><p>&lt;c&gt;</p>");
});

test("Beitrag: Kanäle, Texte und Einstellungen je Plattform", () => {
  const kanaele = [
    { id: "k1", identifier: "x" },
    { id: "k2", identifier: "mastodon" },
    { id: "k3", identifier: "instagram" },
    { id: "k4", identifier: "tiktok" },
    { id: "k5", identifier: "youtube" },
    { id: "k6", identifier: "bluesky", disabled: true },
  ];
  assert.deepEqual(kanaele.filter(unterstuetzt).map((k) => k.id), ["k1", "k2", "k3", "k4"]);

  const bilder = { feed: [{ id: "m1", path: "https://p/1.png", alt: "Alt" }], hoch: [{ id: "h1", path: "https://p/h1.png", alt: "Alt" }] };
  const b = beitrag(abstimmung(1, 17), { kanaele, bilder, datum: "2026-10-18T13:00:00Z", optionen: { tiktokMethode: "UPLOAD" } });
  assert.equal(b.type, "schedule");
  assert.equal(b.posts.length, 4);
  const [x, mastodon, insta, tiktok] = b.posts;
  assert.deepEqual(x.settings, { __type: "x", who_can_reply_post: "everyone", post_type: "post" });
  assert.deepEqual(mastodon.settings, { __type: "mastodon" });
  assert.deepEqual(insta.settings, { __type: "instagram", post_type: "post", collaborators: [] });
  assert.equal(tiktok.settings.content_posting_method, "UPLOAD");
  assert.equal(tiktok.settings.privacy_level, "PUBLIC_TO_EVERYONE");
  assert.deepEqual(x.value[0].image, bilder.feed);
  assert.deepEqual(insta.value[0].image, bilder.feed);
  assert.deepEqual(tiktok.value[0].image, bilder.hoch);
  assert.match(mastodon.value[0].content, /^<p>🇪🇺 EU-Parlament, 17\.10\.2026<\/p>/);
  assert.match(mastodon.value[0].content, /Abstimmung 1 &amp; mehr/);
});

test("Beitrag: Alternativtexte für alle Bilder", () => {
  const alt = alternativtexte(abstimmung(1, 17), 3);
  assert.equal(alt.length, 3);
  assert.match(alt[0], /PIRATEN gestimmt: dafür\. Deutsche Parteien – CDU: dafür, AfD: dagegen/);
  assert.match(alt[2], /Teil 2 von 2/);
});

test("Postiz: Adresse der Public API", () => {
  assert.equal(apiBasis("https://postiz.example.org"), "https://postiz.example.org/api/public/v1");
  assert.equal(apiBasis("https://postiz.example.org/"), "https://postiz.example.org/api/public/v1");
  assert.equal(apiBasis("https://postiz.example.org/api"), "https://postiz.example.org/api/public/v1");
  assert.equal(apiBasis("https://api.postiz.com/public/v1"), "https://api.postiz.com/public/v1");
});

test("Postiz: Key ohne Bearer, Upload als Formular, Fehler mit Status", async () => {
  const aufrufe = [];
  const fetch = async (url, opt) => {
    aufrufe.push({ url, opt });
    if (url.endsWith("/posts")) return new Response("kaputt", { status: 400 });
    return new Response(JSON.stringify({ id: "m1", path: "https://p/1.png" }), { status: 200 });
  };
  const postiz = postizClient({ url: "https://postiz.example.org", apiKey: "geheim", fetch });

  assert.deepEqual(await postiz.hochladen(Buffer.from("png"), "1.png"), { id: "m1", path: "https://p/1.png" });
  assert.equal(aufrufe[0].url, "https://postiz.example.org/api/public/v1/upload");
  assert.equal(aufrufe[0].opt.headers.Authorization, "geheim");
  assert.ok(aufrufe[0].opt.body instanceof FormData);

  await assert.rejects(postiz.beitragAnlegen({}), /HTTP 400 kaputt/);
});

test("Story: nur Instagram und Facebook, Übersicht im Hochformat", () => {
  const bilder = { feed: [{ id: "f1" }], hoch: [{ id: "h1" }, { id: "h2" }] };
  const kanaele = [
    { id: "k1", identifier: "x" },
    { id: "k2", identifier: "instagram" },
    { id: "k3", identifier: "facebook" },
    { id: "k4", identifier: "instagram-standalone", disabled: true },
  ];
  const s = story(abstimmung(1, 17), { kanaele, bilder, datum: "2026-10-18T13:00:00Z" });
  assert.deepEqual(s.posts.map((p) => p.integration.id), ["k2", "k3"]);
  assert.deepEqual(s.posts[0].settings, { __type: "instagram", post_type: "story", collaborators: [] });
  assert.deepEqual(s.posts[1].settings, { __type: "facebook", post_type: "story" });
  assert.deepEqual(s.posts[0].value[0].image, [{ id: "h1" }]);
  assert.equal(story(abstimmung(1, 17), { kanaele: [{ id: "k1", identifier: "x" }], bilder }), null);
});

test("Postiz: zählt Anfragen fürs Stundenlimit", async () => {
  const fetch = async () => new Response("[]", { status: 200 });
  const postiz = postizClient({ url: "https://p", apiKey: "k", fetch });
  await postiz.kanaele();
  await postiz.kanaele();
  assert.equal(postiz.anfragen, 2);
});
