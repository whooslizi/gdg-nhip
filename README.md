# Nhịp — event tickets

Event content lives in `src/data/events.ts`.

## Run it

Needs Node 22+.

```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build   # static site in dist/
```

## Backend

Without `VITE_API_BASE_URL`, `src/lib/mock-api.ts` answers requests in the browser and stores holds and bookings in `localStorage`.

To use the Express backend, configure its `SUPA_URL` and `SUPA_KEY`, start it from `backend/` with `npm run dev`, and set `VITE_API_BASE_URL=http://localhost:3000/api` in the frontend `.env.local`. Restart Vite after changing the environment file.

Live mode uses the routes implemented under `backend/src/routes` for events, showtimes, seats, and holds. In live mode, buyers choose one of an event's showtimes and the seat map is loaded for that showtime. Seat types `normal` and `VIP` are priced at VND 150,000 and VND 250,000 respectively; checkout sends the selected total and buyer contact details to the backend mock-payment endpoint.

The backend does not currently provide booking lookup/listing or cancellation, and a hold cannot be resumed after reloading the page.

## Bot check (Cloudflare Turnstile)

Holding seats, booking lookup and cancellation require a Cloudflare Turnstile token in live mode.

| Variable | Where | Value |
|---|---|---|
| `VITE_TURNSTILE_SITE_KEY` | frontend `.env.local` / Vercel | Turnstile sitekey (public) |
| `TURNSTILE_SECRET_KEY` | `backend/.env` / Vercel | Turnstile secret, never prefixed with `VITE_` |
| `TURNSTILE_HOSTNAMES` | `backend/.env` / Vercel | comma-separated hostnames the widget runs on, e.g. `gdg-nhip.vercel.app` |

For local development use Cloudflare's test keys: sitekey `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (always passes). Never deploy a test secret. Without `TURNSTILE_SECRET_KEY` the backend skips the check in development and refuses these requests with 503 in production; with a real secret, production also needs `TURNSTILE_HOSTNAMES`. Frontend-only mode (no `VITE_API_BASE_URL`) never shows the widget.

## Waiting room

The seat map sits behind a queue (`/api/queue`, table `waiting_room`). Each visit to the seat page joins with a Turnstile check and sends a heartbeat every few seconds. Leaving or reloading the page gives the place up (`/api/queue/leave`, or after 30 quiet seconds), so coming back means queueing again. When it's their turn, guests get 10 seconds to read the rules while a second Turnstile check runs at the gate (`/api/queue/gate`); the seat map opens once both are done ("Open now" skips the reading time, not the check). The public `POST /api/holds` only accepts seats from a visit that passed the gate and is still inside its 10 minutes, so a script can't skip the queue by calling it directly; admin holds (`/api/admin/holds`) are exempt. Up to `WAITING_ROOM_CAPACITY` guests per event (backend env, default 50) are on the seat map at once, each for 10 minutes, after which they go back to the end of the line. Set it to `1` locally and open two tabs to see the queue move. Frontend-only mode has no queue: the visitor is always first in line.

## Admin dashboard

Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in `backend/.env` to enable `/admin`.

Admin event and showtime mutations require the signed bearer session issued by `POST /api/admin/login`. Three failed login attempts from the same client IP trigger a ten-minute lockout. The session expires after eight hours; lockout state is in memory and resets when the backend process restarts.

## Images

Poster photos are CC0 / public domain from Wikimedia Commons, credited on the image as a courtesy; see `public/posters/CREDITS.md`. They are stand-ins and don't show the real events.

## Cancel & refund

Each booking gets a secret cancellation code, shown only on the confirmation page (and in "Booked on this device"), where it can also be cancelled directly, never through email + code lookup.

On "Find my tickets", look up the booking, enter the cancellation code, and the booking is cancelled, its seats are released and a full (simulated) refund is shown — followed by a cat video.

## Disclaimer

nhịp™ is a product of Group 3, Web Developer branch, GDG-HUST Probation. It was built solely for assessment in the GDG-HUST Probation round and is not a commercial service.

All events, products, organizations, people, images, prices and content are there only to demonstrate the product. We do not speak for or represent, sell tickets for, take payment for, or organize or conduct any event mentioned. All transactions, booking references, cancellation codes and refunds are simulated and have no real-world value. Mentioning any organization, person or brand does not imply sponsorship, endorsement or affiliation; all trademarks belong to their respective owners.
