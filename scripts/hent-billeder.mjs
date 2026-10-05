// Finder ét frit licenseret billede pr. art på Wikimedia Commons.
// Fremgangsmåde: artens hovedbillede på engelsk Wikipedia (slås op på latinsk navn)
// -> licens og fotograf hentes fra Commons.
// Kun licenser der tillader genbrug accepteres (Public domain, CC0, CC BY, CC BY-SA).
// CC BY / CC BY-SA kræver kreditering: appen viser derfor fotograf + licens + link.
//
// Output: data/billeder.json  (nøgle = Svampeatlas taxon-id)
// Kør: node scripts/hent-billeder.mjs

import { readFile, writeFile } from "node:fs/promises";

const HEADERS = { "User-Agent": "SvampeKalender/0.1 (privat hobbyprojekt; billedopslag)" };
const WIDTH = 640;
const data = JSON.parse(await readFile(new URL("../data/svampe.json", import.meta.url), "utf8"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const stripHtml = (s) => (s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    if (res.status !== 429 || attempt === 6) throw new Error(`${res.status} ${url}`);
    const wait = Number(res.headers.get("retry-after")) || 5 * attempt;
    await sleep(wait * 1000);
  }
}

// Titel -> filnavn på hovedbillede (følger redirects)
async function pageImages(titles) {
  const result = new Map();
  for (const batch of chunk(titles, 50)) {
    const j = await api("https://en.wikipedia.org/w/api.php", {
      action: "query", prop: "pageimages", piprop: "name", redirects: "1", titles: batch.join("|"),
    });
    const redirect = new Map();
    for (const r of j.query.normalized ?? []) redirect.set(r.from, r.to);
    for (const r of j.query.redirects ?? []) redirect.set(r.from, r.to);
    const byTitle = new Map(j.query.pages.map((p) => [p.title, p.pageimage]));
    for (const t of batch) {
      let cur = t;
      for (let i = 0; i < 3 && redirect.has(cur); i++) cur = redirect.get(cur);
      if (byTitle.get(cur)) result.set(t, byTitle.get(cur));
    }
    await sleep(1500);
  }
  return result;
}

// Hele licensnavnet skal matche (så fx "CC BY-NC" og "CC BY-ND" afvises). Tillader landeversioner som "CC BY-SA 3.0 de".
const OK_LICENSE = /^(public domain|pd|cc0( 1.0)?|cc by(-sa)?( [0-9.]+)?( [a-z]{2})?)$/i;

async function fileInfo(files) {
  const result = new Map();
  for (const batch of chunk(files, 50)) {
    const j = await api("https://commons.wikimedia.org/w/api.php", {
      action: "query", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: String(WIDTH),
      titles: batch.map((f) => `File:${f}`).join("|"),
    });
    for (const p of j.query.pages) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata ?? {};
      result.set(p.title.replace(/^File:/, "").replace(/ /g, "_"), {
        url: ii.thumburl ?? ii.url,
        side: ii.descriptionurl,
        licens: m.LicenseShortName?.value ?? null,
        licensUrl: m.LicenseUrl?.value ?? null,
        fotograf: stripHtml(m.Artist?.value) || null,
      });
    }
    await sleep(1500);
  }
  return result;
}

const arter = data.arter;
const id = (a) => a.id;
const latinHits = await pageImages(arter.map((a) => a.latin));

const fileFor = new Map();
for (const a of arter) {
  const f = latinHits.get(a.latin);
  if (f) fileFor.set(id(a), f.replace(/ /g, "_"));
}
const info = await fileInfo([...new Set(fileFor.values())]);

const billeder = {};
const mangler = [];
for (const a of arter) {
  const i = info.get(fileFor.get(id(a)));
  if (!i || !i.licens || !OK_LICENSE.test(i.licens)) {
    mangler.push(`${a.dansk}${i ? ` (licens: ${i.licens})` : ""}`);
    continue;
  }
  billeder[id(a)] = { dansk: a.dansk, ...i };
}

await writeFile(
  new URL("../data/billeder.json", import.meta.url),
  JSON.stringify(
    {
      kilde: "Wikimedia Commons (https://commons.wikimedia.org/) via Wikipedia",
      hentet: new Date().toISOString().slice(0, 10),
      bemaerk: "CC BY og CC BY-SA kræver at fotograf og licens krediteres ved visning.",
      billeder,
    },
    null,
    1
  )
);

const licenser = {};
for (const b of Object.values(billeder)) licenser[b.licens] = (licenser[b.licens] ?? 0) + 1;
console.log(`Billeder: ${Object.keys(billeder).length}/${arter.length}`);
console.log("Licenser:", licenser);
if (mangler.length) console.log("Mangler:", mangler.join(", "));
