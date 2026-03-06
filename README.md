# Scratch Map MVP

Jednoduchá webová aplikácia, kde kliknutím označíš navštívené krajiny na 2D mape sveta.

## Funkcie
- Klik na krajinu otvorí potvrdenie.
- Potvrdená krajina zmení farbu.
- Opätovný klik umožní krajinu odznačiť.
- Stav sa ukladá do `localStorage` (pretrvá aj po refreshi).

## Spustenie
1. V koreňovom priečinku projektu spusti lokálny server, napr.:
   - `python -m http.server 8080`
2. Otvor v prehliadači:
   - `http://localhost:8080`

## Súbory
- `index.html` - UI a štýly
- `app.js` - logika mapy, interakcie, ukladanie
- `data/world.geojson` - dáta krajín sveta

## Zdroj mapových dát
- `https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson`
