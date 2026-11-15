const http = require("node:http");
const { redis, supabase, SEAT_CHANNEL } = require("./redis");

// Same checks and default as backend/src/controllers/waiting-room.controller.js.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CAPACITY = 50;
const REFRESH_MS = 10_000;
const RECOMPUTE_DELAY_MS = 2_000;
const DEFAULT_MAX_SOCKETS_PER_IP = 20;
const RECOMPUTE_CONCURRENCY = 10;
// Each subscribe can cost an RPC that locks the event's queue, so cap them per socket.
const SUBSCRIBE_LIMIT = 5;
const SUBSCRIBE_WINDOW_MS = 10_000;
const PLACES = new Set(["waiting", "admitted"]);

function capacityFromEnv(env = process.env) {
  const value = Number(env.WAITING_ROOM_CAPACITY);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_CAPACITY;
}

const isId = (value) => Number.isInteger(value) && value > 0;

function maxSocketsPerIpFromEnv(env = process.env) {
  const value = Number(env.MAX_SOCKETS_PER_IP);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_SOCKETS_PER_IP;
}

// X-Forwarded-For can be forged, so it only counts behind a proxy that sets it (TRUST_PROXY=1).
function clientIp(socket, trustProxy) {
  const forwarded = trustProxy && socket.handshake.headers["x-forwarded-for"];
  return (forwarded ? String(forwarded).split(",")[0].trim() : "") || socket.handshake.address;
}

// Runs fn over items, at most `limit` at a time; one failure does not stop the rest.
async function eachLimited(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch (error) {
        console.error("Queue recompute failed:", error.message);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// `io`, `waitingRoom`, `leave` and `eventIdFor` are injected so tests need no Redis or Supabase.
// waitingRoom(eventId, sessionId) is the REST heartbeat: the waiting_room RPC with p_join=false.
function createRealtime({
  io,
  waitingRoom,
  leave,
  eventIdFor,
  refreshMs = REFRESH_MS,
  recomputeDelayMs = RECOMPUTE_DELAY_MS,
  maxSocketsPerIp = DEFAULT_MAX_SOCKETS_PER_IP,
  trustProxy = false,
  clock = Date.now,
}) {
  async function push(socket) {
    const { eventId, sessionId } = socket.data.queue;
    const status = await waitingRoom(eventId, sessionId);
    socket.emit("queue:status", status);
    socket.data.result = status?.result;
    return status;
  }

  // io.use middleware: refuse a client IP's connections past maxSocketsPerIp.
  const perIp = new Map();
  function limitConnections(socket, next) {
    const ip = clientIp(socket, trustProxy);
    const count = perIp.get(ip) ?? 0;
    if (count >= maxSocketsPerIp) return next(new Error("Too many connections"));
    perIp.set(ip, count + 1);
    socket.data.ip = ip;
    next();
  }
  function release(ip) {
    const count = (perIp.get(ip) ?? 0) - 1;
    if (count > 0) perIp.set(ip, count);
    else perIp.delete(ip);
  }

  // Someone left or got in: everyone behind them moved, so tell every waiting socket now
  // instead of at its next refresh. Debounced so a burst of leaves costs one round.
  // shortcut: one RPC per waiting socket per round; move to a batch SQL function if rounds get slow.
  const pending = new Set();
  function recompute(eventId) {
    if (pending.has(eventId)) return;
    pending.add(eventId);
    setTimeout(async () => {
      pending.delete(eventId);
      try {
        // Admitted guests' positions don't move, so only waiting sockets need a push.
        const sockets = await io.in(`queue:${eventId}`).fetchSockets();
        const waiting = sockets.filter((socket) => socket.data.queue && socket.data.result === "waiting");
        await eachLimited(waiting, RECOMPUTE_CONCURRENCY, push);
      } catch (error) {
        console.error("Queue recompute failed:", error.message);
      }
    }, recomputeDelayMs);
  }

  function onConnection(socket) {
    let timer = null;
    let windowStart = -Infinity;
    let messages = 0;
    const allowed = () => {
      if (clock() - windowStart >= SUBSCRIBE_WINDOW_MS) {
        windowStart = clock();
        messages = 0;
      }
      return ++messages <= SUBSCRIBE_LIMIT;
    };

    socket.on("event:subscribe", (payload) => {
      if (!allowed()) return;
      const eventId = Number(payload?.eventId);
      if (isId(eventId)) socket.join(`event:${eventId}`);
    });

    // Sent after a successful REST join, which is where Turnstile is checked. This socket only
    // keeps that place alive and reports it, like the REST heartbeat.
    socket.on("queue:subscribe", async (payload) => {
      if (!allowed()) return;
      const { eventId, sessionId } = payload ?? {};
      if (socket.data.queue || !isId(eventId) || typeof sessionId !== "string" || !UUID.test(sessionId)) return;
      socket.data.queue = { eventId, sessionId };
      socket.join(`queue:${eventId}`);

      let last = null;
      const tick = async () => {
        try {
          const status = await push(socket);
          if (!PLACES.has(status?.result)) {
            // Not (or no longer) in the queue: nothing to keep alive. A server-side close does
            // not call leave().
            clearInterval(timer);
            socket.disconnect(true);
            return;
          }
          if (last === "waiting" && status.result === "admitted") recompute(eventId);
          last = status.result;
        } catch (error) {
          // Hand the tab back to HTTP polling rather than leave its place unrefreshed.
          console.error("Queue refresh failed:", error.message);
          socket.disconnect(true);
        }
      };
      await tick();
      if (socket.connected) timer = setInterval(tick, refreshMs);
    });

    socket.on("disconnect", async (reason) => {
      clearInterval(timer);
      if (socket.data.ip !== undefined) release(socket.data.ip);
      const queue = socket.data.queue;
      // A socket that never held a place can't move anyone up, so it costs no recompute.
      if (!queue || !PLACES.has(socket.data.result)) return;
      try {
        // Only a deliberate close gives the place up. A dropped connection falls back to HTTP
        // polling, which needs the row; if the tab is really gone, 30 quiet seconds remove it.
        if (reason === "client namespace disconnect") await leave(queue.sessionId);
      } catch (error) {
        console.error("Leaving the waiting room failed:", error.message);
      }
      recompute(queue.eventId);
    });
  }

  // A message on nhip:seat-changes from the backend or the worker. Every instance gets it from
  // Redis, so each one emits only to its own sockets.
  async function onSeatMessage(raw) {
    try {
      const { showtimeId, seatIds, status, version } = JSON.parse(raw);
      if (!isId(showtimeId) || !Array.isArray(seatIds) || !Number.isFinite(version)) return;
      const eventId = await eventIdFor(showtimeId);
      if (!eventId) return;
      io.local.to(`event:${eventId}`).emit("seat:availability-changed", {
        eventId: String(eventId),
        showtimeId: String(showtimeId),
        seats: seatIds.map((id) => ({ id: String(id), status, version })),
      });
    } catch (error) {
      console.error("Seat change broadcast failed:", error.message);
    }
  }

  return { onConnection, onSeatMessage, limitConnections };
}

function start() {
  const { Server } = require("socket.io");
  const { createAdapter } = require("@socket.io/redis-adapter");
  const db = supabase();
  const capacity = capacityFromEnv();

  const origins = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  if (!origins.length) throw new Error("Missing ALLOWED_ORIGINS in .env");

  const server = http.createServer((_req, res) => res.end("ok"));
  const pub = redis();
  const io = new Server(server, {
    cors: { origin: origins, credentials: true },
    adapter: createAdapter(pub, pub.duplicate()),
  });

  // A showtime never moves to another event, so the lookup is cached for good.
  const events = new Map();
  const realtime = createRealtime({
    io,
    maxSocketsPerIp: maxSocketsPerIpFromEnv(),
    trustProxy: process.env.TRUST_PROXY === "1",
    waitingRoom: async (eventId, sessionId) => {
      const { data, error } = await db.rpc("waiting_room", {
        p_event_id: eventId,
        p_session_id: sessionId,
        p_join: false,
        p_capacity: capacity,
      });
      if (error) throw error;
      return data;
    },
    leave: async (sessionId) => {
      const { error } = await db.from("waiting_room").delete().eq("sessionid", sessionId);
      if (error) throw error;
    },
    eventIdFor: async (showtimeId) => {
      if (!events.has(showtimeId)) {
        const { data, error } = await db.from("showtimes").select("eventid").eq("showtimeid", showtimeId).maybeSingle();
        if (error) throw error;
        if (!data) return null;
        events.set(showtimeId, data.eventid);
      }
      return events.get(showtimeId);
    },
  });

  io.use(realtime.limitConnections);
  io.on("connection", realtime.onConnection);
  const sub = redis();
  sub.subscribe(SEAT_CHANNEL);
  sub.on("message", (_channel, message) => realtime.onSeatMessage(message));

  const port = Number(process.env.PORT) || 3001;
  server.listen(port, () => console.log(`Realtime server on http://localhost:${port}`));
}

if (require.main === module) start();

module.exports = { createRealtime, capacityFromEnv, maxSocketsPerIpFromEnv };
