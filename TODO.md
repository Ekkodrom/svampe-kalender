# TODO – Svampe Kalender

## Afklaring
- [x] Datakilde: Danmarks Svampeatlas (artsliste) + GBIF (fund pr. måned)
- [x] Spiselighed: vises med tydelig advarsel
- [x] Artsomfang: kun de mest almindelige (min. 200 fund 2015–2025)
- [x] Hosting: kun lokalt (privat GitHub-repo, Pages slået fra) – ejerens valg
- [ ] Ejer: skriv/ret teksten på "Om denne side" (nu et udkast)

## Data
- [x] Hent artsliste og fund pr. måned (`scripts/hent-data.mjs`)
- [x] Byg app-data med regler for omfang, kategori og sæson (`scripts/byg-data.mjs`)
- [ ] Gennemgå sæsoner for kendte arter (fx Karl Johan, Kantarel, Morkel, Fløjlsfod)
- [ ] Overvej korrektion for "indsatsbias": der registreres flest fund om efteråret, fordi flest leder der
- [ ] Overvej dato-opløsning (fx halve måneder) ved at hente fund via GBIF-download i stedet for facetter
- [ ] Gennemgå spiselighedsklassifikationen manuelt (tekst → spiselig/giftig/dødelig)

## Billeder
- [ ] Gennemse billeder manuelt (rigtig art, god kvalitet)
- [ ] Find frie billeder til arter uden billede

## App
- [x] Dato-/månedsvisning, sæson-sektioner, filtre, søgning, detaljevisning
- [x] Faner: Kalender, Svampejagt & Big Year, Om denne side
- [x] Advarsel om spiselighed
- [x] Filter "Kun spiselige" (huskes i browseren)
- [ ] Big Year-tjekliste (gem lokalt)
- [ ] PWA (offline i skoven uden dækning)
