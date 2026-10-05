// Henter fundtal pr. art og måned fra GBIF og artsdata fra Danmarks Svampeatlas.
//
// Kilder:
//  - GBIF: "Danish Mycological Society, fungal records database" (Svampeatlas' fund),
//    https://www.gbif.org/dataset/84d26682-f762-11e1-a439-00145eb45e9a – licens CC BY-NC 4.0.
//  - Danmarks Svampeatlas (https://svampe.databasen.org/) – danske navne, morfogruppe, spiselighed.
//
// Fremgangsmåde:
//  1. GBIF: alle arter med mindst HENT_MIN_FUND fund i Danmark i perioden (én facet-forespørgsel).
//  2. Svampeatlas: alle arter (inkl. synonymer).
//  3. GBIF pr. art: navn, fund pr. måned og det navn Svampeatlas selv har registreret
//     (verbatimScientificName) -> match til Svampeatlas.
//
// Genoptager: arter der allerede er hentet og matchet i data/svampeatlas-raa.json genbruges.
// Slet filen for at hente alt forfra.
//
// Output: data/svampeatlas-raa.json (rådata, bruges af scripts/byg-data.mjs)
// Kør: node scripts/hent-data.mjs

import { readFile, writeFile } from "node:fs/promises";

const SVAMPEATLAS = "https://svampe.databasen.org/api";
const GBIF = "https://api.gbif.org/v1";
const DATASET = "84d26682-f762-11e1-a439-00145eb45e9a";
const AAR = "2015,2025";
const HENT_MIN_FUND = 100; // hent lidt bredere end byg-data.mjs' grænse, så den kan justeres uden ny hentning
const OUT = new URL("../data/svampeatlas-raa.json", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    let wait = 2000 * attempt;
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (attempt >= 8) throw new Error(`${res.status} ${url}`);
      // 429 = for mange forespørgsler: vent længere (Retry-After hvis angivet)
      if (res.status === 429) wait = (Number(res.headers.get("retry-after")) || 10 * attempt) * 1000;
    } catch (err) {
      if (attempt >= 8) throw err;
    }
    await sleep(wait);
  }
}

const gbifQ = (extra) => {
  const q = new URLSearchParams({ datasetKey: DATASET, country: "DK", year: AAR, limit: "0" });
  for (const [k, v] of extra) q.append(k, v);
  return q;
};

// Tidligere hentede arter (genoptag)
const tidligere = new Map();
try {
  for (const a of JSON.parse(await readFile(OUT, "utf8")).arter) if (a.id && a.fundPrMaaned) tidligere.set(a.gbifKey, a);
} catch {}

// 1. Arter med mange fund
console.log("GBIF: arter og antal fund …");
const facet = await getJson(`${GBIF}/occurrence/search?${gbifQ([["facet", "speciesKey"], ["facetLimit", "20000"]])}`);
const noegler = facet.facets[0].counts.filter((c) => c.count >= HENT_MIN_FUND).map((c) => ({ key: c.name, fund: c.count }));
console.log(`${noegler.length} arter med mindst ${HENT_MIN_FUND} fund (${tidligere.size} genbruges)`);

// 2. Svampeatlas: alle arter på artsniveau med navne og attributter (ét stort kald)
console.log("Svampeatlas: artsliste …");
const include = JSON.stringify([
  { model: "TaxonAttributes", as: "attributes", required: false },
  { model: "TaxonDKnames", as: "Vernacularname_DK", required: false },
]);
const taxa = await getJson(`${SVAMPEATLAS}/taxa?${new URLSearchParams({ include, where: JSON.stringify({ RankID: 10000 }), limit: "100000" })}`);
const byId = new Map(taxa.map((t) => [t._id, t]));
const byName = new Map();
for (const t of taxa) {
  const k = t.FullName.toLowerCase();
  if (!byName.has(k) || t._id === t.accepted_id) byName.set(k, t);
}
const grupper = new Map((await getJson(`${SVAMPEATLAS}/morphogroups/`)).map((m) => [m._id, m.name_dk ?? m.name]));
console.log(`${taxa.length} taxa i Svampeatlas`);

// Find Svampeatlas-art ud fra en række kandidatnavne; følg synonym til accepteret navn
function match(navne) {
  for (const n of navne) {
    const k = n.toLowerCase().split(/\s+/).slice(0, 2).join(" ");
    let t = byName.get(k);
    if (t) {
      if (t.accepted_id !== t._id) t = byId.get(t.accepted_id) ?? t;
      return t;
    }
  }
  return null;
}

// 3. Pr. art
const arter = [];
const koe = [...noegler];
let i = 0;
async function arbejder() {
  while (koe.length) {
    const { key, fund } = koe.shift();
    const gammel = tidligere.get(key);
    if (gammel) {
      arter.push({ ...gammel, fund });
      i++;
      continue;
    }
    try {
      const sp = await getJson(`${GBIF}/species/${key}`);
      const j = await getJson(`${GBIF}/occurrence/search?${gbifQ([["speciesKey", key], ["facet", "month"], ["facet", "verbatimScientificName"], ["facetLimit", "12"]])}`);
      const facetter = Object.fromEntries((j.facets ?? []).map((f) => [f.field, f.counts]));
      const pr = Array(12).fill(0);
      for (const c of facetter.MONTH ?? []) pr[Number(c.name) - 1] = c.count;
      const verbatim = (facetter.VERBATIM_SCIENTIFIC_NAME ?? []).map((c) => c.name);
      const t = match([...verbatim, sp.canonicalName ?? ""]);
      const a = t?.attributes ?? {};
      arter.push({
        gbifKey: key,
        gbifNavn: sp.canonicalName,
        rige: sp.kingdom,
        fund,
        fundPrMaaned: pr,
        id: t?._id ?? null,
        latin: t?.FullName ?? sp.canonicalName,
        dansk: t?.Vernacularname_DK?.vernacularname_dk ?? null,
        gruppeId: t?.morphogroup_id ?? null,
        gruppe: grupper.get(t?.morphogroup_id) ?? null,
        systematik: t?.SystematicPath ?? null,
        tilStedeIDK: a.PresentInDK ?? null,
        spiselighed: a.spiselighedsrapport || null,
        link: t ? `https://svampe.databasen.org/taxon/${t._id}` : null,
      });
    } catch (err) {
      console.warn(`\nFejl for GBIF-art ${key}: ${err.message}`);
    }
    process.stdout.write(`\r${++i}/${noegler.length}            `);
    await sleep(250);
  }
}
await Promise.all(Array.from({ length: 3 }, arbejder));

arter.sort((a, b) => (a.systematik ?? "~").localeCompare(b.systematik ?? "~"));
await writeFile(
  OUT,
  JSON.stringify(
    {
      kilder: [
        "Danmarks Svampeatlas – https://svampe.databasen.org/",
        `GBIF: Danish Mycological Society, fungal records database – https://www.gbif.org/dataset/${DATASET} (CC BY-NC 4.0)`,
      ],
      hentet: new Date().toISOString().slice(0, 10),
      fundperiode: AAR.replace(",", "-"),
      arter,
    },
    null,
    1
  )
);
const fejl = noegler.length - arter.length;
console.log(`\nGemt ${arter.length} arter (${arter.filter((a) => !a.id).length} uden match i Svampeatlas, ${fejl} fejlede – kør igen for at hente dem)`);
