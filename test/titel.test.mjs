import { test } from "node:test";
import assert from "node:assert/strict";
import { titelZuordnen, abstimmungenLaden } from "../lib/titel.mjs";

function htv(id, tag, referenz, [f, a, e]) {
  return { id, zeitpunkt: `2026-10-${tag} 12:00:00`, referenz, stimmen: { FOR: f, AGAINST: a, ABSTENTION: e } };
}
function csv(id, tag, reference, [f, a, e], title) {
  return { id, date: `2026-10-${tag}T12:00:00`, reference, title, for_count: f, against_count: a, abstention_count: e };
}

test("Zuordnung über Tag und Dokumentkürzel, kleine Abweichungen bei Stimmen erlaubt", () => {
  const deutsch = [csv("e1", "08", "A10-0197/2026", [620, 21, 22], "Stilllegung Ignalina"), csv("e2", "08", "B10-0400/2026", [482, 41, 39], "Duma-Wahl")];
  const englisch = [csv("e1", "08", "A10-0197/2026", [620, 21, 22], "Ignalina"), csv("e2", "08", "B10-0400/2026", [482, 41, 39], "Duma elections")];
  const r = titelZuordnen([htv(1, "08", "A10-0197/2026", [625, 20, 22]), htv(2, "08", "b10-0400/2026", [482, 41, 39])], deutsch, englisch);
  assert.deepEqual(r, { 1: "Stilllegung Ignalina", 2: "Duma-Wahl" });
});

test("Mehrere Abstimmungen zum selben Dokument: die mit passenden Stimmen", () => {
  const deutsch = [csv("e1", "15", "A10-0039/2026", [559, 48, 62], "Fischerei I"), csv("e2", "15", "A10-0039/2026", [100, 500, 9], "Fischerei II")];
  const r = titelZuordnen([htv(5, "15", "A10-0039/2026", [100, 500, 9]), htv(6, "15", "A10-0039/2026", [559, 48, 62])], deutsch, []);
  assert.deepEqual(r, { 5: "Fischerei II", 6: "Fischerei I" });
});

test("Kein Titel bei englischem Rückfall, anderem Tag, zu großer Abweichung oder Mehrdeutigkeit", () => {
  const englisch = [csv("e1", "08", "A1", [10, 10, 10], "Same title")];
  assert.deepEqual(titelZuordnen([htv(1, "08", "A1", [10, 10, 10])], [csv("e1", "08", "A1", [10, 10, 10], "Same title")], englisch), {});
  assert.deepEqual(titelZuordnen([htv(1, "09", "A1", [10, 10, 10])], [csv("e1", "08", "A1", [10, 10, 10], "Titel")], []), {});
  assert.deepEqual(titelZuordnen([htv(1, "08", "A1", [10, 10, 10])], [csv("e1", "08", "A1", [100, 10, 10], "Titel")], []), {});
  // ohne Referenz zwei gleich gute Kandidaten → nicht eindeutig
  const zwei = [csv("e1", "08", null, [10, 10, 10], "Eins"), csv("e2", "08", null, [10, 10, 10], "Zwei")];
  assert.deepEqual(titelZuordnen([htv(1, "08", null, [10, 10, 10])], zwei, []), {});
});

test("Laden: alle Seiten, deutsche Titel per lang=de", async () => {
  const urls = [];
  const fetch = async (url) => {
    urls.push(url);
    const page = Number(new URL(url).searchParams.get("page"));
    return new Response(JSON.stringify({ total_pages: 2, votes: [{ id: `v${page}` }] }), { status: 200 });
  };
  const votes = await abstimmungenLaden({ basis: "https://check-some-votes.eu/", lang: "de", von: "2026-10-01", bis: "2026-10-18", fetch });
  assert.deepEqual(votes.map((v) => v.id), ["v1", "v2"]);
  assert.equal(urls[0], "https://check-some-votes.eu/api/votes?lang=de&start_date=2026-10-01&end_date=2026-10-18&page=1&page_size=100");
});
