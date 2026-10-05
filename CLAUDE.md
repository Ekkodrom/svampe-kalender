# Svampe Kalender

Søsterprojekt til `../fugle kalender`. Webside der hjælper danske svampeinteresserede med at planlægge deres **Big Year** (flest svampearter fundet i Danmark på ét kalenderår) og deres svampeture.

## Formål
- Vis hvilke svampearter der kan findes i Danmark på en given dag/måned.
- Vis hvornår sæsonen for hver art begynder og slutter, og hvornår den har højsæson.
- Samme spilleregler og opbygning som fuglesiden (dato/måned, "Sæsonen slutter", filtre for almindelige/fåtallige/sjældne – sjældne fra som standard).

## Sikkerhed (vigtigst)
- Siden må **aldrig** kunne opfattes som en guide til at spise svampe.
- Advarslen øverst på kalenderen og i detaljevisningen må ikke fjernes.
- Spiselighed vises (ejerens valg) men altid med advarsel og kildeangivelse (Svampeatlas).
- Giftlinjen: 82 12 12 12.

## Afgrænsning af arter (`scripts/byg-data.mjs`)
- Udgangspunkt: alle arter med mindst 100 fund i Svampeatlas-datasættet på GBIF 2015–2025 (`hent-data.mjs`), matchet til Svampeatlas på latinsk navn (inkl. synonymer).
- Bogflaget `bog_Gyldendal_art_medtages` bruges IKKE – det er ufuldstændigt (fx mangler Grøn fluesvamp).
- **Med:** rige Fungi + dansk navn + morfogruppe med synlige frugtlegemer + mindst `MIN_FUND` (200) fund 2015–2025 (ejeren ønsker kun de mest almindelige).
- **Ude:** mikrosvampe, meldug, rust, skimmel, gær, laver m.m. (se `UDELAD_GRUPPER`).
- Kategori efter fund: ≥ 1000 almindelig, ≥ 500 fåtallig, ellers sjælden (alt relativt – alle arter på listen er forholdsvis hyppige).

## Data
- `data/svampeatlas-raa.json` – rådata (hentes med `scripts/hent-data.mjs`, tager ~20 min).
- `data/svampe.json` – det appen bruger (bygges med `scripts/byg-data.mjs`).
- `data/billeder.json` – billeder (hentes med `scripts/hent-billeder.mjs`).
- Felter: se `meta.felter` i `data/svampe.json`.
- Svampedata har **måneds-opløsning** (GBIF facetterer kun på måned) – ingen ankomst/afrejse-datoer som på fuglesiden.
- Danske navne fra Svampeatlas er med lille begyndelsesbogstav; første bogstav gøres stort ved visning.

## Kilder og licens (skal altid krediteres)
- **Danmarks Svampeatlas** – https://svampe.databasen.org/ – artsliste, danske navne, morfogruppe, spiselighed. Hver art linker til `https://svampe.databasen.org/taxon/<id>`.
- **GBIF** – *Danish Mycological Society, fungal records database* – https://www.gbif.org/dataset/84d26682-f762-11e1-a439-00145eb45e9a – fund pr. måned. **Licens CC BY-NC 4.0**: kun ikke-kommerciel brug, kreditering påkrævet.
- Svampeatlas' API er udokumenteret. Taxa-forespørgsler kræver `include` som JSON-array af objekter, hvor `where` selv er en JSON-streng (se `hent-data.mjs`).
- Kopiér **ikke** Svampeatlas' længere tekster (økologi, beskrivelser, bogtekst fra *Danmarks svampe*) – de er sandsynligvis ophavsretligt beskyttede. Link i stedet til artssiden.
- Billeder: Wikimedia Commons, kun Public domain/CC0/CC BY/CC BY-SA, med fotograf + licens + link.

## Struktur
```
index.html, style.css, app.js   Statisk webside (vanilla JS, ingen build), mobil først
data/                           Se ovenfor
scripts/hent-data.mjs           Svampeatlas + GBIF -> svampeatlas-raa.json
scripts/byg-data.mjs            Rådata -> svampe.json (regler og tærskler)
scripts/hent-billeder.mjs       Wikimedia Commons -> billeder.json
scripts/valider-data.mjs        Tjekker svampe.json og billeder.json
```

## Kør lokalt
```
python -m http.server 8000
```

## Udgivelse (GitHub Pages)
- Repo: https://github.com/Ekkodrom/svampe-kalender (offentligt, branch `main`, rodmappe)
- Live: https://ekkodrom.github.io/svampe-kalender/
- Push til `main` udgiver automatisk. GitHub CLI: `E:Program FilesGitHub CLIgh.exe` (konto: Ekkodrom).

## Kode
- Datoaritmetik: brug `plusDage()` (kalenderdage), aldrig `getTime() + 24t` – det fejler ved sommertid.
- Al brugervendt tekst på dansk. Escape alt data med `esc()` før det sættes i HTML.
- Hold koden i samme stil som fuglesiden; fælles forbedringer bør laves begge steder.
