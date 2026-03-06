# Scratch Map MVP+

Romantická webová aplikácia na spoločnú mapu ciest Matúš + Hanička.

## Kategórie krajín
- `Nenavštívené`
- `Navštívené`
- `Blízka budúcnosť`
- `Wishlist Kobliho` (modrá)
- `Wishlist Kobližky` (ružová)

## Funkcie
- Zoom + pan mapy (vrátane mobilných tlačidiel `+/- Zoom`).
- Tenšie hranice krajín a lepšia orientácia pri zoome na mobile.
- Slovenské názvy krajín.
- Jedna spoločná live verzia mapy (žiadne roomy/verzie v UI).

## Spustenie
1. V koreňovom priečinku projektu spusti lokálny server, napr.:
   - `python -m http.server 8080`
   - alebo `npx --yes serve -l 8080 .`
2. Otvor v prehliadači:
   - `http://localhost:8080`

## Verejná URL na zdieľanie
- Predvolená produkčná URL: `https://matuslong.github.io/scratch-map/`
- Túto URL môžeš poslať Haničke alebo komukoľvek inému. Každý uvidí rovnakú mapu a môže ju upraviť.

## Live sync setup (Supabase)
App používa jeden fixný záznam mapy: `room_id = 'matus-hanicka-main'`.

1. Vytvor projekt v Supabase.
2. V SQL editore spusti:

```sql
create table if not exists public.map_rooms (
  room_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.map_rooms enable row level security;

create policy "public can read rooms"
on public.map_rooms
for select
using (true);

create policy "public can upsert rooms"
on public.map_rooms
for insert
with check (true);

create policy "public can update rooms"
on public.map_rooms
for update
using (true)
with check (true);
```

3. V [index.html](C:\dev\scratch-map\index.html) vyplň `window.APP_CONFIG`:

```html
<script>
  window.APP_CONFIG = {
    supabaseUrl: "https://YOUR_PROJECT.supabase.co",
    supabaseAnonKey: "YOUR_ANON_KEY"
  };
</script>
```

4. Otvor appku na rovnakom odkaze u seba aj u Haničky. Zmeny sa budú synchronizovať realtime.

## GitHub Pages deploy
- Repo obsahuje workflow pre automatický deploy statickej stránky na GitHub Pages.
- Po pushi na `main` sa stránka aktualizuje automaticky.

## Súbory
- [index.html](C:\dev\scratch-map\index.html) - UI, štýl, mobilné ovládanie
- [app.js](C:\dev\scratch-map\app.js) - mapa, stavy, zoom, local storage, realtime sync
- [data/world.geojson](C:\dev\scratch-map\data\world.geojson) - geometria krajín
- [data/country-names-sk.json](C:\dev\scratch-map\data\country-names-sk.json) - slovenské názvy krajín podľa ISO A3
