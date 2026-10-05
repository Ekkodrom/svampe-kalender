// Tjekker data/svampe.json og data/billeder.json for fejl og uoverensstemmelser.
// Kør: node scripts/valider-data.mjs   (exit-kode 1 ved fejl)

import { readFile } from "node:fs/promises";

const load = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
const { arter } = await load("../data/svampe.json");
let billeder = {};
try { ({ billeder } = await load("../data/billeder.json")); } catch { console.log("ADVARSEL: data/billeder.json mangler"); }

const SAESON = ["helår", "forår", "sommer", "efterår", "vinter"];
const KATEGORI = ["almindelig", "fåtallig", "sjælden"];
const SPISE = ["spiselig", "uspiselig", "undgå", "muligvis giftig", "giftig", "dødelig"];
const fejl = [];
const advarsler = [];
const set = (navn) => { const s = new Set(); return (v, a) => { if (s.has(v)) fejl.push(`${a.dansk}: dublet ${navn} "${v}"`); s.add(v); }; };
const unikId = set("id"), unikDansk = set("dansk navn"), unikLatin = set("latinsk navn");
let utenBillede = 0;

for (const a of arter) {
  const n = a.dansk ?? "(uden navn)";
  unikId(a.id, a); unikDansk(a.dansk, a); unikLatin(a.latin, a);
  for (const f of ["id", "dansk", "latin", "periode", "kilde"]) if (!a[f]) fejl.push(`${n}: mangler ${f}`);
  if (!SAESON.includes(a.saeson)) fejl.push(`${n}: ugyldig saeson "${a.saeson}"`);
  if (!KATEGORI.includes(a.kategori)) fejl.push(`${n}: ugyldig kategori "${a.kategori}"`);
  if (!Number.isInteger(a.fund) || a.fund <= 0) fejl.push(`${n}: ugyldigt antal fund`);
  const m = a.maaneder;
  if (!Array.isArray(m) || m.length !== 12 || m.some((v) => ![0, 1, 2].includes(v))) fejl.push(`${n}: maaneder skal være 12 værdier i 0/1/2`);
  else if (!m.includes(2)) fejl.push(`${n}: ingen højsæson-måned`);
  if (a.spiselighed !== null && (!SPISE.includes(a.spiselighed?.klasse) || !a.spiselighed?.tekst)) fejl.push(`${n}: ugyldig spiselighed`);
  if (!a.gruppe) advarsler.push(`${n}: ingen gruppe`);
  if (!billeder[a.id]) utenBillede++;
}
for (const k of Object.keys(billeder)) if (!arter.some((a) => a.id === k)) advarsler.push(`billeder.json: ukendt nøgle ${k}`);

const c = {};
for (const a of arter) c[a.kategori] = (c[a.kategori] ?? 0) + 1;
console.log(`${arter.length} arter`, c, `uden billede: ${utenBillede}`);
for (const a of advarsler) console.log("ADVARSEL:", a);
for (const f of fejl) console.log("FEJL:", f);
console.log(fejl.length ? `${fejl.length} fejl` : "Ingen fejl");
process.exit(fejl.length ? 1 : 0);
