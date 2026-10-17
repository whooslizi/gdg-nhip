# Nhịp — event tickets

Event content lives in `src/data/events.ts`.

## Run it

Needs Node 22+.

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/
```

## Backend

The site currently runs without a server. When `VITE_API_BASE_URL` is unset, `src/lib/mock-api.ts` answers every API call in the browser and keeps holds and bookings in `localStorage`, so bookings are only visible in the browser that made them.

To use a real API, set `VITE_API_BASE_URL` (and `VITE_SOCKET_URL` for live seat updates). The client then calls the same REST routes the mock implements.

## Images

Poster photos are CC0 / public domain from Wikimedia Commons, credited on the image as a courtesy; see `public/posters/CREDITS.md`. They are stand-ins and don't show the real events.

## Cancel & refund

Each booking gets a secret cancellation code, shown only on the confirmation page (and in "Booked on this device"), where it can also be cancelled directly, never through email + code lookup. On "Find my tickets", look up the booking, enter the cancellation code, and the booking is cancelled, its seats are released and a full (simulated) refund is shown — followed by a cat video.

## Disclaimer

nhịp™ is a product of Group 3, Web Developer branch, GDG-HUST Probation. It was built solely for assessment in the GDG-HUST Probation round and is not a commercial service. All events, products, organizations, people, images, prices and content are there only to demonstrate the product. We do not speak for or represent, sell tickets for, take payment for, or organize or conduct any event mentioned. All transactions, booking references, cancellation codes and refunds are simulated and have no real-world value. Mentioning any organization, person or brand does not imply sponsorship, endorsement or affiliation; all trademarks belong to their respective owners.