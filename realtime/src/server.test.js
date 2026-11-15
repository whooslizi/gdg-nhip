const assert = require("node:assert/strict");
const test = require("node:test");
const { createRealtime, allowOrigins } = require("./server");

const SESSION = "0b6f1c1e-3f5a-4c2e-9d1a-7e8f9a0b1c2d";
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fakeSocket({ address = "10.0.0.1", headers = {} } = {}) {
  const handlers = {};
  return {
    handlers,
    handshake: { address, headers },
    data: {},
    connected: true,
    rooms: new Set(),
    emitted: [],
    on(event, fn) {
      handlers[event] = fn;
    },
    join(room) {
      this.rooms.add(room);
    },
    emit(event, payload) {
      this.emitted.push([event, payload]);
    },
    disconnect() {
      this.connected = false;
      handlers.disconnect?.("server namespace disconnect");
    },
  };
}

function setup({ waitingRoom, leave = async () => {}, sockets = [], ...options } = {}) {
  const broadcasts = [];
  const io = {
    in: () => ({ fetchSockets: async () => sockets }),
    local: { to: (room) => ({ emit: (event, payload) => broadcasts.push([room, event, payload]) }) },
  };
  const realtime = createRealtime({
    io,
    waitingRoom,
    leave,
    eventIdFor: async (showtimeId) => (showtimeId === 7 ? 1 : null),
    refreshMs: 60_000,
    recomputeDelayMs: 0,
    ...options,
  });
  return { realtime, broadcasts };
}

const status = (result, ahead = 0) => ({ result, ahead, expiresAt: null, serverTime: "2026-11-15T00:00:00Z" });

test("queue:subscribe refreshes the place and pushes the REST heartbeat shape", async () => {
  const calls = [];
  const { realtime } = setup({ waitingRoom: async (...args) => (calls.push(args), status("waiting", 2)) });
  const socket = fakeSocket();
  realtime.onConnection(socket);

  await socket.handlers["queue:subscribe"]({ eventId: 1, sessionId: SESSION });
  assert.deepEqual(calls, [[1, SESSION]]);
  assert.deepEqual(socket.emitted, [["queue:status", status("waiting", 2)]]);
  assert.ok(socket.rooms.has("queue:1"));
  socket.handlers.disconnect("transport close");
});

test("bad queue payloads are dropped", async () => {
  const { realtime } = setup({ waitingRoom: async () => assert.fail("must not reach the database") });
  const socket = fakeSocket();
  realtime.onConnection(socket);
  for (const payload of [null, {}, { eventId: 0, sessionId: SESSION }, { eventId: "1", sessionId: SESSION }, { eventId: 1, sessionId: "nope" }]) {
    await socket.handlers["queue:subscribe"](payload);
  }
  assert.deepEqual(socket.emitted, []);
});

test("a deliberate close leaves the queue and moves everyone else up; a dropped one keeps the place", async () => {
  const left = [];
  const other = fakeSocket();
  other.data.queue = { eventId: 1, sessionId: "1b6f1c1e-3f5a-4c2e-9d1a-7e8f9a0b1c2d" };
  other.data.result = "waiting";
  const { realtime } = setup({
    waitingRoom: async () => status("waiting", 0),
    leave: async (sessionId) => left.push(sessionId),
    sockets: [other],
  });

  const dropped = fakeSocket();
  realtime.onConnection(dropped);
  await dropped.handlers["queue:subscribe"]({ eventId: 1, sessionId: SESSION });
  await dropped.handlers.disconnect("transport close");
  assert.deepEqual(left, []);

  const closed = fakeSocket();
  realtime.onConnection(closed);
  await closed.handlers["queue:subscribe"]({ eventId: 1, sessionId: SESSION });
  await closed.handlers.disconnect("client namespace disconnect");
  assert.deepEqual(left, [SESSION]);
  await flush();
  assert.deepEqual(other.emitted.at(-1), ["queue:status", status("waiting", 0)]);
});

test("a failing refresh hands the tab back to HTTP polling", async (t) => {
  t.mock.method(console, "error", () => {});
  const { realtime } = setup({
    waitingRoom: async () => {
      throw new Error("db down");
    },
  });
  const socket = fakeSocket();
  realtime.onConnection(socket);
  await socket.handlers["queue:subscribe"]({ eventId: 1, sessionId: SESSION });
  assert.equal(socket.connected, false);
});

test("seat changes go to the event's room in the SeatChangeMessage shape", async (t) => {
  t.mock.method(console, "error", () => {});
  const { realtime, broadcasts } = setup();
  await realtime.onSeatMessage(JSON.stringify({ showtimeId: 7, seatIds: [3, 4], status: "AVAILABLE", version: 99 }));
  await realtime.onSeatMessage(JSON.stringify({ showtimeId: 8, seatIds: [1], status: "HELD", version: 1 }));
  await realtime.onSeatMessage("not json");
  assert.deepEqual(broadcasts, [
    [
      "event:1",
      "seat:availability-changed",
      {
        eventId: "1",
        showtimeId: "7",
        seats: [
          { id: "3", status: "AVAILABLE", version: 99 },
          { id: "4", status: "AVAILABLE", version: 99 },
        ],
      },
    ],
  ]);
});

test("a session that is not in the queue gets its status once, then the socket closes without leaving", async () => {
  const left = [];
  const calls = [];
  const { realtime } = setup({
    waitingRoom: async () => (calls.push(1), status("not_in_queue")),
    leave: async (sessionId) => left.push(sessionId),
    sockets: [],
  });
  const socket = fakeSocket();
  realtime.onConnection(socket);
  await socket.handlers["queue:subscribe"]({ eventId: 1, sessionId: SESSION });
  await flush();
  assert.deepEqual(socket.emitted, [["queue:status", status("not_in_queue")]]);
  assert.equal(socket.connected, false);
  assert.deepEqual(left, []);
  assert.equal(calls.length, 1); // no refresh timer, no recompute round
});

test("connections past the per-IP cap are refused, and a disconnect frees a slot", async () => {
  const { realtime } = setup({ maxSocketsPerIp: 2 });
  const results = [];
  const connect = (socket) => realtime.limitConnections(socket, (error) => results.push(error?.message ?? "ok"));
  const sockets = [fakeSocket(), fakeSocket(), fakeSocket()];
  sockets.forEach(connect);
  assert.deepEqual(results, ["ok", "ok", "Too many connections"]);

  connect(fakeSocket({ address: "10.0.0.2" }));
  assert.equal(results.at(-1), "ok");

  realtime.onConnection(sockets[0]);
  await sockets[0].handlers.disconnect("transport close");
  connect(fakeSocket());
  assert.equal(results.at(-1), "ok");
});

test("X-Forwarded-For only counts when the proxy is trusted", () => {
  const forwarded = () => fakeSocket({ headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } });
  const run = (trustProxy) => {
    const { realtime } = setup({ maxSocketsPerIp: 20, trustProxy });
    const socket = forwarded();
    realtime.limitConnections(socket, () => {});
    return socket.data.ip;
  };
  assert.equal(run(true), "203.0.113.9");
  assert.equal(run(false), "10.0.0.1");
});

test("subscribe messages past 5 per 10 s are ignored", async () => {
  let now = 0;
  const { realtime } = setup({ clock: () => now });
  const socket = fakeSocket();
  realtime.onConnection(socket);
  for (let i = 1; i <= 7; i++) socket.handlers["event:subscribe"]({ eventId: i });
  assert.deepEqual([...socket.rooms], ["event:1", "event:2", "event:3", "event:4", "event:5"]);
  now = 10_000;
  socket.handlers["event:subscribe"]({ eventId: 8 });
  assert.ok(socket.rooms.has("event:8"));
});

test("a recompute pushes only to waiting sockets, at most 10 at a time", async () => {
  let running = 0;
  let peak = 0;
  const sockets = Array.from({ length: 25 }, (_, i) => {
    const socket = fakeSocket();
    socket.data.queue = { eventId: 1, sessionId: SESSION };
    socket.data.result = i < 22 ? "waiting" : "admitted";
    return socket;
  });
  const { realtime } = setup({
    sockets,
    waitingRoom: async () => {
      peak = Math.max(peak, ++running);
      await flush();
      running--;
      return status("waiting", 0);
    },
  });
  const leaving = fakeSocket();
  realtime.onConnection(leaving);
  leaving.data.queue = { eventId: 1, sessionId: SESSION };
  leaving.data.result = "waiting";
  await leaving.handlers.disconnect("transport close");
  for (let i = 0; i < 20; i++) await flush();
  assert.equal(sockets.filter((socket) => socket.emitted.length).length, 22);
  assert.equal(peak, 10);
});

test("only listed origins may connect, on any transport", () => {
  const allow = allowOrigins(["https://gdg-nhip.vercel.app"]);
  const answer = (origin) => {
    let result;
    allow({ headers: origin ? { origin } : {} }, (error, ok) => (result = [error, ok]));
    return result;
  };
  assert.deepEqual(answer("https://gdg-nhip.vercel.app"), [null, true]);
  assert.deepEqual(answer("https://evil.example"), ["origin not allowed", false]);
  assert.deepEqual(answer(undefined), ["origin not allowed", false]);
});
