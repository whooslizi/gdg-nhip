const assert = require("node:assert/strict");
const test = require("node:test");

// The controller pulls in the Supabase client, which refuses to load without these.
process.env.SUPA_URL ||= "http://localhost:54321";
process.env.SUPA_KEY ||= "test-key";
const { holdHandler } = require("./hold.controller");

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
