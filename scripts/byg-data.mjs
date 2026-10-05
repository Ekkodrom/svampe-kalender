// Bygger data/svampe.json (det appen bruger) ud fra data/svampeatlas-raa.json.
// Kør: node scripts/byg-data.mjs
//
// Regler (justér konstanterne herunder):
//  - Med: arter med dansk navn, i en morfogruppe med synlige frugtlegemer,
//    og mindst MIN_FUND fund i Svampeatlas i fundperioden.
//  - Kategori efter antal fund: almindelig / fåtallig / sjælden.
//  - Månedsværdi ud fra fund pr. måned i forhold til artens bedste måned.

import { readFile, writeFile } from "node:fs/promises";

const MIN_FUND = 200;          // under dette: ikke med (ca. 20 fund om året)
const ALMINDELIG_FUND = 1000;  // >= almindelig
const FAATALLIG_FUND = 500;    // >= fåtallig, ellers sjælden
const HOEJSAESON = 0.25;       // måned >= 25 % af bedste måned -> 2
const TIL_STEDE = 0.05;        // måned >= 5 % af bedste måned (og >= MIN_MAANED fund) -> 1
const MIN_MAANED = 3;

// Morfogrupper uden synlige frugtlegemer (mikrosvampe, laver m.m.) – udelades
const UDELAD_GRUPPER = new Set([2, 38, 128, 129, 132, 133, 134, 135, 136, 137, 138, 139, 143, 144, 145, 146, 147, 148, 149, 150, 151, 153]);

const MAANEDER = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
const stort = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const raa = JSON.parse(await readFile(new URL("../data/svampeatlas-raa.json", import.meta.url), "utf8"));

function maanedsVaerdier(pr) {
  const max = Math.max(...pr);
  return pr.map((n) => (n >= max * HOEJSAESON ? 2 : n >= max * TIL_STEDE && n >= MIN_MAANED ? 1 : 0));
}

function saeson(maaneder, pr) {
  if (maaneder.filter((v) => v > 0).length >= 10) return "helår";
  const sum = (idx) => idx.reduce((s, i) => s + pr[i], 0);
  const s = { forår: sum([2, 3, 4]), sommer: sum([5, 6, 7]), efterår: sum([8, 9, 10]), vinter: sum([11, 0, 1]) };
  return Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];
}

// Sammenhængende perioder (også hen over nytår), fx "September–november"
function periodeTekst(maaneder, pr) {
  if (maaneder.every((v) => v > 0)) {
    const top = pr.indexOf(Math.max(...pr));
    return `Hele året, flest i ${MAANEDER[top]}`;
  }
  const start = maaneder.findIndex((v, i) => v > 0 && maaneder[(i + 11) % 12] === 0);
  const dele = [];
  for (let k = 0; k < 12; k++) {
    const i = (start + k) % 12;
    if (maaneder[i] > 0 && maaneder[(i + 11) % 12] === 0) dele.push([i, i]);
    else if (maaneder[i] > 0) dele[dele.length - 1][1] = i;
  }
  const tekst = dele.map(([a, b]) => (a === b ? MAANEDER[a] : `${MAANEDER[a]}–${MAANEDER[b]}`)).join(" og ");
  return stort(tekst);
}

// Klassificér Svampeatlas' spiselighedstekst. Sikkerhed først: ved tvivl aldrig "spiselig".
// Rækkefølgen betyder noget – de farligste klasser tjekkes først.
function spiselighed(raatekst) {
  if (!raatekst) return null;
  // Fjern interne redaktionelle noter fra Svampeatlas
  const tekst = raatekst
    .replace(/hvem siger det\?:\s*/gi, "")
    .replace(/\s*\[who says\?\]/gi, "")
    .replace(/\(\s*\(/g, "(")
    .trim();
  const t = tekst.toLowerCase();
  let klasse = null;
  if (/dødelig/.test(t)) klasse = "dødelig";
  else if (/tidligere været angivet som spiselig|bør ikke spises|bedst undgået|bør undgås/.test(t)) klasse = "undgå";
  else if (/^muligvis giftig/.test(t)) klasse = "muligvis giftig";
  else if (/(?<!ikke )giftig/.test(t)) klasse = "giftig";
  else if (/uspiselig|ikke spiselig/.test(t)) klasse = "uspiselig";
  else if (/^spiselig/.test(t)) klasse = "spiselig";
  return klasse ? { klasse, tekst } : null;
}

// Flere GBIF-arter kan pege på samme Svampeatlas-art (synonymer) – læg fundene sammen
const samlet = new Map();
for (const a of raa.arter) {
  if (!a.id) continue;
  const s = samlet.get(a.id);
  if (s) {
    s.fund += a.fund;
    s.fundPrMaaned = s.fundPrMaaned.map((n, i) => n + a.fundPrMaaned[i]);
  } else samlet.set(a.id, { ...a, fundPrMaaned: [...a.fundPrMaaned] });
}

const arter = [];
const udeladt = { ikkeISvampeatlas: raa.arter.filter((a) => !a.id).length, ikkeSvamp: 0, udenDanskNavn: 0, mikrosvamp: 0, faaFund: 0 };
for (const a of samlet.values()) {
  if (a.rige !== "Fungi") { udeladt.ikkeSvamp++; continue; }
  if (!a.dansk) { udeladt.udenDanskNavn++; continue; }
  if (UDELAD_GRUPPER.has(a.gruppeId)) { udeladt.mikrosvamp++; continue; }
  if (!a.fund || a.fund < MIN_FUND || !a.fundPrMaaned) { udeladt.faaFund++; continue; }
  const maaneder = maanedsVaerdier(a.fundPrMaaned);
  arter.push({
    id: String(a.id),
    dansk: stort(a.dansk.trim()),
    latin: a.latin,
    gruppe: a.gruppe,
    saeson: saeson(maaneder, a.fundPrMaaned),
    kategori: a.fund >= ALMINDELIG_FUND ? "almindelig" : a.fund >= FAATALLIG_FUND ? "fåtallig" : "sjælden",
    periode: periodeTekst(maaneder, a.fundPrMaaned),
    maaneder,
    fund: a.fund,
    spiselighed: spiselighed(a.spiselighed),
    kilde: a.link,
  });
}

// Samme danske navn for flere arter (fx efter artsopdeling): tilføj latinsk navn
const navneTal = new Map();
for (const a of arter) navneTal.set(a.dansk, (navneTal.get(a.dansk) ?? 0) + 1);
for (const a of arter) if (navneTal.get(a.dansk) > 1) a.dansk = `${a.dansk} (${a.latin})`;

const meta = {
  titel: "Svampe Kalender – danske svampearter",
  opdateret: raa.hentet,
  fundperiode: raa.fundperiode,
  kilder: raa.kilder,
  licens: "Afledt af Svampeatlas-data under CC BY-NC 4.0 – må kun bruges ikke-kommercielt og med kreditering.",
  regler: { MIN_FUND, ALMINDELIG_FUND, FAATALLIG_FUND, HOEJSAESON, TIL_STEDE, MIN_MAANED },
  felter: {
    id: "Svampeatlas' taxon-id",
    saeson: "helår | forår | sommer | efterår | vinter (hvor flest fund er gjort)",
    kategori: "almindelig | fåtallig | sjælden – efter antal fund i fundperioden",
    maaneder: "12 tal (jan..dec): 0 = sjældent/aldrig fundet, 1 = findes, men færre, 2 = højsæson",
    fund: "Antal fund i Svampeatlas i fundperioden (via GBIF)",
    spiselighed: "{ klasse: spiselig | uspiselig | undgå | muligvis giftig | giftig | dødelig, tekst } fra Svampeatlas, eller null",
  },
};

const lines = arter.map((a) => "    " + JSON.stringify(a));
await writeFile(
  new URL("../data/svampe.json", import.meta.url),
  JSON.stringify({ meta }, null, 2).replace(/\n}$/, ',\n  "arter": [\n' + lines.join(",\n") + "\n  ]\n}\n")
);
const k = {};
for (const a of arter) k[a.kategori] = (k[a.kategori] ?? 0) + 1;
console.log(`${arter.length} arter`, k, "udeladt:", udeladt);
