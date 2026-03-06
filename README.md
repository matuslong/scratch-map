# Scratch Map MVP

Romantická webová aplikácia na spoločnú mapu ciest, kde je možné krajiny označiť ako:
- `Navštívené`
- `V pláne (blízka budúcnosť)`
- `Neoznačené`

## Funkcie
- Zoom a pan mapy (koliesko myši/pinch + ťahanie).
- Klik na krajinu otvorí výber stavu.
- Dve farebné kategórie: navštívené a plánované.
- Slovenské názvy krajín.
- Stav sa ukladá do `localStorage` (pretrvá po refreshi).

## Spustenie
1. V koreňovom priečinku projektu spusti lokálny server, napr.:
   - `python -m http.server 8080`
   - alebo `npx --yes serve -l 8080 .`
2. Otvor v prehliadači:
   - `http://localhost:8080`

## Súbory
- `index.html` - UI, romantický vizuálny štýl, legenda a modal
- `app.js` - logika mapy, zoom, interakcie, stavy krajín a ukladanie
- `data/world.geojson` - geometria krajín
- `data/country-names-sk.json` - slovenské názvy krajín podľa ISO A3

## Zdroj mapových dát
- `https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson`

## Zdroj slovenských názvov krajín
- `https://raw.githubusercontent.com/mledoze/countries/master/countries.json`
