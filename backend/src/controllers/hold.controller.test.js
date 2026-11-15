const assert = require("node:assert/strict");
const test = require("node:test");

// The controller pulls in the Supabase client, which refuses to load without these.
process.env.SUPA_URL ||= "http://localhost:54321";
process.env.SUPA_KEY ||= "test-key";
// Keep the default hold queue a no-op even if backend/.env sets REDIS_URL (dotenv never overrides).
process.env.REDIS_URL = "";
const { holdHandler, cancelHoldHandler } = require("./hold.controller");
const { createHoldQueue } = require("../services/hold-queue.service");

async function call(handler, body) {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  await handler({ body }, res);
  return res;
}

const seats = (n) => Array.from({ length: n }, (_, i) => i + 1);

test("the public hold caps seats; the admin hold takes any number", async () => {
  let held;
  const hold = async (_showtimeId, seatIds) => {
    held = seatIds;
    return { holdToken: "t", seatIds };
  };

  const capped = await call(holdHandler(8, { hold }), { showtimeId: 1, seatIds: seats(9) });
  assert.equal(capped.statusCode, 400);
  assert.equal(held, undefined);
  assert.equal((await call(holdHandler(8, { hold }), { showtimeId: 1, seatIds: seats(8) })).statusCode, 201);

  const admin = await call(holdHandler(Infinity, { hold }), { showtimeId: 1, seatIds: seats(300) });
  assert.equal(admin.statusCode, 201);
  assert.equal(held.length, 300);
});

test("the admin hold still validates its input", async () => {
  const hold = async () => assert.fail("must not reach the database");
  const handler = holdHandler(Infinity, { hold });
  for (const body of [
    { showtimeId: 0, seatIds: [1] },
    { showtimeId: 1, seatIds: [] },
    { showtimeId: 1, seatIds: [1, 1] },
    { showtimeId: 1, seatIds: ["1"] },
  ]) {
    assert.equal((await call(handler, body)).statusCode, 400);
  }
});

test("the public hold only accepts a tab that passed the waiting room gate", async () => {
  const SESSION = "0b6f1c1e-3f5a-4c2e-9d1a-7e8f9a0b1c2d";
  let checked;
  const passed = new Set([SESSION]);
  const handler = holdHandler(8, {
    hold: async () => ({ holdToken: "t" }),
    mayHold: async (sessionId, showtimeId) => {
      checked = [sessionId, showtimeId];
      return passed.has(sessionId);
    },
  });

  const ok = await call(handler, { showtimeId: 4, seatIds: [1], queueSessionId: SESSION });
  assert.equal(ok.statusCode, 201);
  assert.deepEqual(checked, [SESSION, 4]);

  for (const queueSessionId of [undefined, "", "not-a-uuid", "1b6f1c1e-3f5a-4c2e-9d1a-7e8f9a0b1c2d"]) {
    const refused = await call(handler, { showtimeId: 4, seatIds: [1], queueSessionId });
    assert.equal(refused.statusCode, 403);
    assert.equal(refused.payload.code, "QUEUE_REQUIRED");
  }
});

test("a failing queue check refuses the hold instead of skipping it", async () => {
  const handler = holdHandler(8, {
    hold: async () => assert.fail("must not hold"),
    mayHold: async () => {
      throw new Error("db down");
    },
  });
  const res = await call(handler, {
    showtimeId: 4,
    seatIds: [1],
    queueSessionId: "0b6f1c1e-3f5a-4c2e-9d1a-7e8f9a0b1c2d",
  });
  assert.equal(res.statusCode, 500);
});

test("a hold schedules its release and announces the held seats", async () => {
  const calls = [];
  const queue = {
    scheduleRelease: async (...args) => calls.push(["schedule", ...args]),
    publishSeatChange: async (seats, status) => calls.push(["publish", seats.seatIds, status]),
  };
  const hold = async (showtimeId, seatIds) => ({ holdToken: "t", showtimeId, seatIds, expiresAt: "2026-11-15T10:10:00Z" });
  const res = await call(holdHandler(8, { hold, queue }), { showtimeId: 4, seatIds: [1, 2] });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(calls, [
    ["schedule", "t", "2026-11-15T10:10:00Z"],
    ["publish", [1, 2], "HELD"],
  ]);
});

test("the hold still returns 201 when the queue throws", async (t) => {
  t.mock.method(console, "error", () => {});
  class Broken {
    async add() {
      throw new Error("redis down");
    }
    async publish() {
      throw new Error("redis down");
    }
  }
  const queue = createHoldQueue({ redisUrl: "redis://x", Queue: Broken, Redis: Broken });
  const hold = async (showtimeId, seatIds) => ({ holdToken: "t", showtimeId, seatIds, expiresAt: new Date().toISOString() });
  const res = await call(holdHandler(8, { hold, queue }), { showtimeId: 4, seatIds: [1] });
  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.data.holdToken, "t");
});

test("cancelling a hold drops its release job and frees the seats it had", async () => {
  const calls = [];
  const queue = {
    seatsForHold: async () => ({ showtimeId: 4, seatIds: [1] }),
    cancelRelease: async (token) => calls.push(["cancel", token]),
    publishSeatChange: async (seats, status) => calls.push(["publish", seats.seatIds, status]),
  };
  const ok = await call(cancelHoldHandler({ cancel: async () => ({ success: true }), queue }), { holdToken: " t " });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(calls, [
    ["cancel", "t"],
    ["publish", [1], "AVAILABLE"],
  ]);

  calls.length = 0;
  const gone = await call(cancelHoldHandler({ cancel: async () => ({ success: false }), queue }), { holdToken: "t" });
  assert.equal(gone.statusCode, 409);
  assert.deepEqual(calls, []);
});
