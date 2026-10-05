# Svampe Kalender

Se hvilke svampe der kan findes i Danmark i dag – eller på en valgt dato/måned – og planlæg din svampetur eller dit Big Year.

> **Spis aldrig en svamp ud fra denne side.** Få altid dine svampe kontrolleret af en svampekontrollant.

## Kilder
- Artsliste, danske navne og spiselighed: [Danmarks Svampeatlas](https://svampe.databasen.org/).
- Sæson og hyppighed er beregnet ud fra Svampeatlas' fund 2015–2025 via [GBIF](https://www.gbif.org/dataset/84d26682-f762-11e1-a439-00145eb45e9a) (Danish Mycological Society, fungal records database, CC BY-NC 4.0).
- Billeder: [Wikimedia Commons](https://commons.wikimedia.org/) under frie licenser. Fotograf og licens vises ved hvert billede.

Data på denne side er afledt af data under CC BY-NC 4.0 og må kun bruges ikke-kommercielt.

## Kør lokalt
```
python -m http.server 8000
```

## Opdater data
```
node scripts/hent-data.mjs      # ~20 min
node scripts/byg-data.mjs
node scripts/hent-billeder.mjs
node scripts/valider-data.mjs
```
