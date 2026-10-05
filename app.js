const MAANEDER = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
const MAANEDER_KORT = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
const SAESON = {
  alle: "Alle",
  helår: "Hele året",
  forår: "Forår",
  sommer: "Sommer",
  efterår: "Efterår",
  vinter: "Vinter",
};
const SPISELIGHED = {
  spiselig: { cls: "spis", tekst: "Spiselig" },
  uspiselig: { cls: "faa", tekst: "Uspiselig" },
  undgå: { cls: "gift", tekst: "Bør undgås" },
  "muligvis giftig": { cls: "gift", tekst: "Muligvis giftig" },
  giftig: { cls: "gift", tekst: "Giftig" },
  dødelig: { cls: "doed", tekst: "Dødeligt giftig" },
};
const SIDSTE_CHANCE_DAGE = 21;
const NY_DAGE = 14;
const SNART_DAGE = 14;

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const state = {
  mode: "dato",
  dato: idag(),
  maaned: new Date().getMonth(),
  saeson: "alle",
  gruppe: "",
  soeg: "",
  niveauer: hentNiveauer(),
  kunSpiselige: hentValg("svampe-kun-spiselige"),
  sortering: "system",
};

let arter = [];
let billeder = {};
let meta = {};

function hentNiveauer() {
  const standard = { almindelig: true, fåtallig: true, sjælden: false };
  try {
    const gemt = JSON.parse(localStorage.getItem("svampe-niveauer"));
    if (gemt && typeof gemt === "object") return { ...standard, ...gemt };
  } catch {}
  return standard;
}

function hentValg(noegle) {
  try { return localStorage.getItem(noegle) === "1"; } catch { return false; }
}

function gemValg(noegle, vaerdi) {
  try { localStorage.setItem(noegle, vaerdi ? "1" : "0"); } catch {}
}

function gemNiveauer() {
  try { localStorage.setItem("svampe-niveauer", JSON.stringify(state.niveauer)); } catch {}
}

function idag() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function tilInputDato(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fraInputDato(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Læg dage til i lokal kalendertid (sikkert hen over skift mellem sommer- og vintertid)
function plusDage(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function formatDato(d) {
  return `${d.getDate()}. ${MAANEDER[d.getMonth()]}`;
}

// Kan arten findes på en bestemt dato? Svampedata har måneds-opløsning.
function kanSes(art, dato) {
  return art.maaneder[dato.getMonth()] > 0;
}

// Første dato fra og med `fra` (højst `max` dage frem) hvor kanSes === ønsket
function findSkift(art, fra, oensket, max) {
  for (let i = 0; i <= max; i++) {
    const d = plusDage(fra, i);
    if (kanSes(art, d) === oensket) return d;
  }
  return null;
}

function analyserDato(art, dato) {
  const nu = kanSes(art, dato);
  const info = { art, nu };
  if (nu) {
    const slut = findSkift(art, dato, false, SIDSTE_CHANCE_DAGE);
    if (slut) {
      info.forsvinder = slut;
      info.tilbage = findSkift(art, slut, true, 366);
    }
    if (!kanSes(art, plusDage(dato, -NY_DAGE))) info.ny = true;
  } else {
    const kommer = findSkift(art, dato, true, SNART_DAGE);
    if (kommer) info.kommer = kommer;
  }
  return info;
}

function passerFilter(art) {
  if (state.saeson !== "alle" && art.saeson !== state.saeson) return false;
  if (state.gruppe && art.gruppe !== state.gruppe) return false;
  if (state.kunSpiselige && art.spiselighed?.klasse !== "spiselig") return false;
  if (state.soeg) {
    const q = state.soeg.toLowerCase();
    if (!art.dansk.toLowerCase().includes(q) && !art.latin.toLowerCase().includes(q)) return false;
  }
  return true;
}

function sorter(liste) {
  if (state.sortering === "alfa") {
    return [...liste].sort((a, b) => a.art.dansk.localeCompare(b.art.dansk, "da"));
  }
  return liste;
}

// Hyppighed i en given måned: sjældne arter er altid "sjælden",
// ellers afgør månedsværdien (2 = almindelig, 1 = fåtallig).
function niveau(art, m) {
  if (art.kategori === "sjælden") return "sjælden";
  return art.maaneder[m] === 2 ? "almindelig" : "fåtallig";
}

function aktivMaaned() {
  return state.mode === "dato" ? state.dato.getMonth() : state.maaned;
}

/* ---------- Rendering ---------- */

function thumb(art) {
  const b = billeder[art.id];
  if (b) return `<img class="thumb" src="${esc(b.url)}" alt="${esc(art.dansk)}" loading="lazy" decoding="async">`;
  return `<span class="thumb" aria-hidden="true">🍄</span>`;
}

function maanedsbar(art, aktiv) {
  return `<span class="bar" aria-hidden="true">${art.maaneder
    .map((v, i) => `<span class="v${v}${v && art.kategori === "sjælden" ? " sj" : ""}${i === aktiv ? " nu" : ""}"></span>`)
    .join("")}</span>`;
}

function spiseTag(art) {
  const s = art.spiselighed && SPISELIGHED[art.spiselighed.klasse];
  return s ? `<span class="tag ${s.cls}">${s.tekst}</span>` : "";
}

function kort(info, maaned) {
  const { art } = info;
  const tags = [`<span class="tag">${esc(SAESON[art.saeson])}</span>`];
  const niv = niveau(art, info.kommer ? info.kommer.getMonth() : maaned);
  if (niv === "fåtallig") tags.push(`<span class="tag faa">Fåtallig</span>`);
  if (niv === "sjælden") tags.push(`<span class="tag sj">Sjælden</span>`);
  tags.push(spiseTag(art));
  if (info.forsvinder) tags.push(`<span class="tag warn">Sæsonen slutter ca. ${formatDato(info.forsvinder)}</span>`);
  if (info.ny) tags.push(`<span class="tag new">Sæsonen er begyndt</span>`);
  if (info.kommer) tags.push(`<span class="tag new">Sæsonen begynder ca. ${formatDato(info.kommer)}</span>`);
  if (info.tilbage) tags.push(`<span class="tag">Igen ca. ${formatDato(info.tilbage)}</span>`);
  if (info.maanedTag) tags.push(`<span class="tag ${info.maanedTag.cls}">${esc(info.maanedTag.tekst)}</span>`);
  return `<button class="kort" data-id="${esc(art.id)}">
    ${thumb(art)}
    <span class="kort-tekst">
      <span class="navn">${esc(art.dansk)}</span>
      <span class="latin">${esc(art.latin)}</span>
      <span class="periode">${esc(art.periode)}</span>
      <span class="tags">${tags.join("")}</span>
      ${maanedsbar(art, maaned)}
    </span>
  </button>`;
}

function sektion(cls, titel, tekst, liste, maaned) {
  if (!liste.length) return "";
  return `<section class="sektion ${cls}">
    <h3>${esc(titel)} <span class="count">(${liste.length})</span></h3>
    ${tekst ? `<p>${esc(tekst)}</p>` : ""}
    <div class="grid">${sorter(liste).map((i) => kort(i, maaned)).join("")}</div>
  </section>`;
}

function renderDato() {
  const dato = state.dato;
  const erIdag = dato.getTime() === idag().getTime();
  const analyseret = arter.filter(passerFilter).map((a) => analyserDato(a, dato));
  const alle = analyseret.filter((i) => state.niveauer[niveau(i.art, (i.kommer ?? dato).getMonth())]);
  const synlige = alle.filter((i) => i.nu);
  const skjulte = analyseret.filter((i) => i.nu).length - synlige.length;

  const sidste = synlige.filter((i) => i.forsvinder);
  const nye = synlige.filter((i) => i.ny && !i.forsvinder);
  const resten = synlige.filter((i) => !i.forsvinder && !i.ny);
  const snart = alle.filter((i) => i.kommer);

  $("#overskrift").textContent = erIdag ? `I dag, ${formatDato(dato)}` : `${formatDato(dato)} ${dato.getFullYear()}`;
  $("#optaelling").textContent = `${synlige.length} arter kan findes i Danmark${erIdag ? " i dag" : " denne dag"}.${skjulte ? ` ${skjulte} skjult af dine valg.` : ""}`;

  const m = dato.getMonth();
  $("#sektioner").innerHTML =
    sektion("sidste", "Sæsonen slutter", `Sæsonen slutter inden for ${SIDSTE_CHANCE_DAGE} dage.`, sidste, m) +
    sektion("nye", "Sæsonen er begyndt", `Sæsonen er begyndt inden for de seneste ${NY_DAGE} dage.`, nye, m) +
    sektion("snart", "Sæsonen begynder snart", `Sæsonen begynder inden for ${SNART_DAGE} dage.`, snart, m) +
    sektion("", "Kan findes", "", resten, m) || `<p class="tom">Ingen arter matcher dine filtre.</p>`;
}

function renderMaaned() {
  const m = state.maaned;
  const tilStede = arter.filter((a) => a.maaneder[m] > 0 && passerFilter(a));
  const synlige = tilStede.filter((a) => state.niveauer[niveau(a, m)]);
  const skjulte = tilStede.length - synlige.length;

  const infos = synlige.map((art) => {
    const info = { art };
    if (art.maaneder[(m + 11) % 12] === 0) info.maanedTag = { cls: "new", tekst: `Sæsonen begynder i ${MAANEDER[m]}` };
    if (art.maaneder[(m + 1) % 12] === 0) info.maanedTag = { cls: "warn", tekst: "Sidste måned i sæsonen" };
    return info;
  });

  const sidste = infos.filter((i) => i.maanedTag?.cls === "warn");
  const nye = infos.filter((i) => i.maanedTag?.cls === "new");
  const resten = infos.filter((i) => !i.maanedTag);

  $("#overskrift").textContent = MAANEDER[m][0].toUpperCase() + MAANEDER[m].slice(1);
  $("#optaelling").textContent = `${synlige.length} arter kan findes i Danmark i ${MAANEDER[m]}.${skjulte ? ` ${skjulte} skjult af dine valg.` : ""}`;
  $("#sektioner").innerHTML =
    sektion("sidste", "Sæsonen slutter", `Findes i ${MAANEDER[m]}, men normalt ikke i ${MAANEDER[(m + 1) % 12]}.`, sidste, m) +
    sektion("nye", "Sæsonen begynder", `Findes normalt ikke i ${MAANEDER[(m + 11) % 12]}, men i ${MAANEDER[m]}.`, nye, m) +
    sektion("", "Kan findes", "", resten, m) || `<p class="tom">Ingen arter matcher dine filtre.</p>`;
}

function render() {
  $("#mode-dato").setAttribute("aria-selected", state.mode === "dato");
  $("#mode-maaned").setAttribute("aria-selected", state.mode === "maaned");
  $("#panel-dato").hidden = state.mode !== "dato";
  $("#panel-maaned").hidden = state.mode !== "maaned";
  document.querySelectorAll("#months button").forEach((b, i) => b.setAttribute("aria-pressed", i === state.maaned));
  document.querySelectorAll("#saeson-chips button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.saeson === state.saeson));
  $("#dato").value = tilInputDato(state.dato);
  $("#spise-advarsel").hidden = !state.kunSpiselige;
  if (state.mode === "dato") renderDato();
  else renderMaaned();
}

/* ---------- Detaljevisning ---------- */

function visDetalje(id) {
  const art = arter.find((a) => a.id === id);
  if (!art) return;
  const b = billeder[id];
  const aktiv = aktivMaaned();
  const fakta = [
    ["Sæson", art.periode],
    ["Hyppighed", { almindelig: "Almindelig", fåtallig: "Fåtallig – kræver indsats", sjælden: "Sjælden – få fund om året" }[art.kategori]],
    ["Gruppe", art.gruppe],
    ["Fund", `${art.fund.toLocaleString("da-DK")} fund i Svampeatlas ${meta.fundperiode ?? ""}`],
  ];
  const s = art.spiselighed;
  const spise = s
    ? `<div class="advarsel"><strong>${esc(SPISELIGHED[s.klasse]?.tekst ?? "Spiselighed")}${s.tekst ? ` – ${esc(s.tekst)}` : ""}</strong>Kilde: Danmarks Svampeatlas. Spis aldrig en svamp ud fra denne side – få den altid kontrolleret af en svampekontrollant.</div>`
    : "";

  $("#detalje-indhold").innerHTML = `
    ${b ? `<img class="d-billede" src="${esc(b.url)}" alt="${esc(art.dansk)}">` : `<div class="d-billede"></div>`}
    ${b ? `<p class="d-credit">Foto: ${esc(b.fotograf || "ukendt")} · ${b.licensUrl ? `<a href="${esc(b.licensUrl)}" target="_blank" rel="noopener">${esc(b.licens)}</a>` : esc(b.licens)} · <a href="${esc(b.side)}" target="_blank" rel="noopener">Wikimedia Commons</a></p>` : `<p class="d-credit">Intet frit billede fundet endnu.</p>`}
    <div class="d-body">
      <h2 id="d-navn">${esc(art.dansk)}</h2>
      <div class="latin">${esc(art.latin)}</div>
      <div class="d-maaneder">${art.maaneder
        .map((v, i) => `<div class="v${v}${v && art.kategori === "sjælden" ? " sj" : ""}"><span${i === aktiv ? ' style="outline:2px solid var(--text);outline-offset:1px"' : ""}></span>${MAANEDER_KORT[i]}</div>`)
        .join("")}</div>
      <div class="legend"><span><i style="background:var(--m2)"></i>Højsæson</span><span><i style="background:var(--m1)"></i>Findes, men færre</span><span><i style="background:var(--m0)"></i>Sjældent eller aldrig</span></div>
      <dl class="fakta">${fakta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      ${spise}
      <p><a href="${esc(art.kilde)}" target="_blank" rel="noopener">Se ${esc(art.dansk)} i Danmarks Svampeatlas →</a></p>
      <p class="d-credit">Ikke en sikker vejledning – brug aldrig siden til at afgøre, om en svamp kan spises.</p>
    </div>`;
  $("#detalje").showModal();
}

/* ---------- Opsætning ---------- */

function opsaetKontroller() {
  $("#months").innerHTML = MAANEDER_KORT.map((m) => `<button type="button">${m}</button>`).join("");
  $("#saeson-chips").innerHTML = Object.entries(SAESON)
    .map(([k, v]) => `<button type="button" data-saeson="${k}">${v}</button>`)
    .join("");

  $("#mode-dato").addEventListener("click", () => { state.mode = "dato"; render(); });
  $("#mode-maaned").addEventListener("click", () => { state.mode = "maaned"; render(); });
  $("#dato").addEventListener("change", (e) => { if (e.target.value) { state.dato = fraInputDato(e.target.value); render(); } });
  $("#idag").addEventListener("click", () => { state.dato = idag(); render(); });
  document.querySelectorAll("#months button").forEach((b, i) => b.addEventListener("click", () => { state.maaned = i; render(); }));
  $("#saeson-chips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) { state.saeson = b.dataset.saeson; render(); }
  });
  $("#gruppe").addEventListener("change", (e) => { state.gruppe = e.target.value; render(); });
  $("#soeg").addEventListener("input", (e) => { state.soeg = e.target.value.trim(); render(); });
  document.querySelectorAll("[data-niveau]").forEach((cb) => {
    cb.checked = state.niveauer[cb.dataset.niveau];
    cb.addEventListener("change", () => {
      state.niveauer[cb.dataset.niveau] = cb.checked;
      gemNiveauer();
      render();
    });
  });
  $("#kun-spiselige").checked = state.kunSpiselige;
  $("#kun-spiselige").addEventListener("change", (e) => {
    state.kunSpiselige = e.target.checked;
    gemValg("svampe-kun-spiselige", state.kunSpiselige);
    render();
  });
  $("#sortering").addEventListener("change", (e) => { state.sortering = e.target.value; render(); });
  $("#sektioner").addEventListener("click", (e) => {
    const k = e.target.closest(".kort");
    if (k) visDetalje(k.dataset.id);
  });
  $("#detalje").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
}

function udfyldGrupper() {
  const grupper = [...new Set(arter.map((a) => a.gruppe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "da"));
  $("#gruppe").insertAdjacentHTML("beforeend", grupper.map((g) => `<option value="${esc(g)}">${esc(g[0].toUpperCase() + g.slice(1))}</option>`).join(""));
}

// Faner: hash -> side. Ukendt eller tom hash viser kalenderen.
const SIDER = {
  kalender: "Svampe Kalender",
  guide: "Svampejagt & Big Year – Svampe Kalender",
  om: "Om denne side – Svampe Kalender",
};

// Velkomstvindue med ansvarsfraskrivelse – vises indtil brugeren har bekræftet
function visVelkomst() {
  if (hentValg("svampe-forstaaet")) return;
  const d = $("#velkomst");
  d.addEventListener("cancel", (e) => e.preventDefault()); // kan ikke lukkes med Esc uden at bekræfte
  d.addEventListener("close", () => { if (d.returnValue === "ok") gemValg("svampe-forstaaet", true); });
  d.showModal();
}

function visSide() {
  const hash = location.hash.slice(1);
  const aktiv = hash in SIDER ? hash : "kalender";
  for (const side of Object.keys(SIDER)) {
    $(`#side-${side}`).hidden = side !== aktiv;
    if (side === aktiv) $(`#fane-${side}`).setAttribute("aria-current", "page");
    else $(`#fane-${side}`).removeAttribute("aria-current");
  }
  document.title = SIDER[aktiv];
}

async function start() {
  opsaetKontroller();
  visSide();
  visVelkomst();
  window.addEventListener("hashchange", () => { visSide(); window.scrollTo(0, 0); });
  try {
    const [f, b] = await Promise.all([fetch("data/svampe.json"), fetch("data/billeder.json")]);
    const data = await f.json();
    meta = data.meta;
    arter = data.arter;
    billeder = b.ok ? (await b.json()).billeder : {};
  } catch (err) {
    $("#sektioner").innerHTML = `<p class="tom">Kunne ikke indlæse data. Siden skal åbnes via en webserver (ikke direkte som fil).</p>`;
    throw err;
  }
  udfyldGrupper();
  render();
}

start();
