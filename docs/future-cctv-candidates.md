# Future CCTV candidates

Standalone list of CCTV/webcam sources surveyed but **not yet built** as packs. Maintained here (not in `DATA_SOURCES.md`, which documents only live data). Surveyed 2026-10-02, verified live on the web that day.

## The still-image fetch model

The CCTV layer's current packs fetch **periodically-refreshed stills** (`feedType: 'image'`) from a published URL. Almost every local UK webcam is a **stream** (HLS / Twitch / WordPress plugin player), which the layer does not consume yet. A stream-capable fetcher would unlock the stream-only candidates below; until then they are parked here, not in a queue.

Two source patterns fit the still-image model today:

1. **Independent still-image operators** — e.g. vision-environnement.com (used by the Chichester harbour webcam): a periodic image behind a stable URL.
2. **National Highways motorway CCTV via the [trafficcameras.uk](https://trafficcameras.uk/) mirror** — per-road pages; stills refresh roughly daily; NH keeps the feeds partner-only (police and involved parties, 7-day retention), so the mirror re-publishes frames without NH's authorisation. Packs built on it carry that caveat in every camera's `license` field and are removed on request.

## Candidates

### 1. Full M3 (61 more cameras) — next in line

The mirror's `/m3` page carries the M3 end to end. The corridor pack already registered the **western stub** (J12–J14, the M27 × M3 interchange) because those cameras sit on the corridor's route. The remaining **61 cameras** (J1–J11, including the J4A spur and the "M3–M25" camera) form the natural next pack:

- **Positions**: same anchor as the corridor — junction node-cluster centroids from the NH Open Data Network Model (OGL, token-free), between-junction midpoints documented per camera. The M3 link geometry is already downloaded in the corridor build (`/tmp/nh_model.json` on the build machine).
- **License**: same mirror caveat as the corridor pack.
- **Heading**: mainline bearings through adjacent junction centroids, as in the corridor.
- **Note**: the M3's junction 14 is the M27 interchange itself, already in the corridor pack — the next pack starts west of it and must not duplicate those five cameras.

### 2. Newhaven (East Sussex) — fits the still-image model

- **Farson Digital Watercams**: 2 cameras (harbour + river) served as Environment-Agency-style azure-CDN stills. The exact image endpoint was not yet probed; the first build step is pinning it down and confirming refresh cadence.
- **Peter Leonard Marine** re-broadcasts two of the local feeds as Twitch streams (`iotwa02`, `newhavenwebcams`) — stream-only, parked.
- The local sailing club cam is seasonal.

### 3. Portsmouth — HMS Warrior mast camera (stream)

Official Portsmouth Historic Dockyard webcam on the HMS Warrior's mast; pans across the Camber/Gosport waterfront 7am–5pm. The player is JS-embedded and was not pinned down in the survey. Third-party re-hosts (CruisingEarth, MangoLink, SkylineWebcams) exist but are weak on licence. Stream-only → parked until a stream fetcher exists.

### 4. Bognor Regis — pier cams (stream)

Independent pier cameras (bognorregisbeach.co.uk east, bognor.today west) run 24/7 HD through an ipcamlive player; **no snapshot endpoint found** → stream-only → parked.

### 5. Isle of Wight (stream)

isleofwight.com runs ~10 donation-funded cameras (Ryde ×4 incl. Aspire — the best Solent/ferry view — Needles, Colwell/Hurst Castle, Ventnor, Sandown, Whitwell, Shanklin, Cowes, Havenstreet), all WordPress-plugin streams with static asset thumbnails. Best single candidate if a stream fetcher appears: the **Cowes ferry cam** (IoW Council, Camsecure) or the **Royal Esplanade Hotel, Ryde** (via Railcam UK).

## Excluded (checked, no candidate)

| Source | Why it is out |
| --- | --- |
| Brighton (headvibe.co.uk cams) | Dead — `webcam2.jpg` last modified 2022, byte-identical across fetches |
| Brighton (windy-beach.co.uk) | States "won't auto refresh" |
| Southampton port cam | YouTube-only 24/7 (same exclusion class as the cathedral peregrines) |
| Chichester Cathedral peregrine cams | YouTube-only, no real stream |
| Dell Quay Sailing Club | Looping YouTube embeds |
| West Itchenor Sailing Club | Host decommissioned — HLS 404, only a 2018 snapshot survives |

## Recently built (no longer candidates)

- **M27 corridor pack** (this build): 69 cameras from the mirror's `/m27` page (NH "M27" J3–J12, i.e. the Portsmouth→Ringwood corridor labelled "M271" on some maps; no mirrored cameras at the J1/J2 western end) plus the two M275 cameras at the Portsmouth-end interchange and the five M3-stub cameras (J12–J14). See `DATA_SOURCES.md`.

## Numbering note (correction to an earlier survey entry)

An earlier version of this survey listed "NH M27 J1–J14 (Portsmouth→Waterlooville)". That was wrong: the NH public "M27" runs **J1 (Ringwood) → J12 (A27/M275 Hilsea interchange, Portsmouth end)** with no J6, and is labelled "M271" on some maps. The corridor pack's positions and names use the corrected numbering; its "J12" cameras are at the Portsmouth end, not Emsworth.
