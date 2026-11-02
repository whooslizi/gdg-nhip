const assert = require("node:assert/strict");
const test = require("node:test");
const { waitingRoomHandler, leaveHandler, gateHandler, capacityFromEnv } = require("./waiting-room.controller");

const SESSION = "0b6f1c1e-3f5a-4c2e-9d1a-7e8f9a0b1c2d";

async function call(rpc, body, join = false) {
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
  await waitingRoomHandler(rpc, join, () => 25)({ body }, res);
  return res;
}

test("passes join/heartbeat and capacity to the database and returns its status", async () => {
  const status = { result: "waiting", ahead: 4, expiresAt: null, serverTime: "2026-11-02T12:00:00Z" };
  let args;
  const rpc = async (...a) => {
    args = a;
    return status;
  };
  const joined = await call(rpc, { eventId: 3, sessionId: SESSION }, true);
  assert.equal(joined.statusCode, 200);
  assert.deepEqual(joined.payload, { success: true, data: status });
  assert.deepEqual(args, [3, SESSION, true, 25]);

  await call(rpc, { eventId: 3, sessionId: SESSION }, false);
  assert.deepEqual(args, [3, SESSION, false, 25]);
});

test("rejects malformed input without touching the database", async () => {
  let calls = 0;
  const rpc = async () => {
    calls += 1;
  };
  for (const body of [
    undefined,
    {},
    { eventId: "3", sessionId: SESSION },
    { eventId: 0, sessionId: SESSION },
    { eventId: 1.5, sessionId: SESSION },
    { eventId: 3, sessionId: "not-a-uuid" },
    { eventId: 3, sessionId: 42 },
  ]) {
    assert.equal((await call(rpc, body)).statusCode, 400);
  }
  assert.equal(calls, 0);
});

test("maps an unknown event to 404 and other errors to a generic 500", async () => {
  const missing = await call(async () => {
    throw { code: "23503" };
  }, { eventId: 999, sessionId: SESSION });
  assert.equal(missing.statusCode, 404);

  const broken = await call(async () => {
    throw new Error("db down: secret detail");
  }, { eventId: 3, sessionId: SESSION });
  assert.equal(broken.statusCode, 500);
  assert.equal(broken.payload.message, "Internal server error");
});

test("capacity comes from WAITING_ROOM_CAPACITY, falling back to 50 on bad values", () => {
  assert.equal(capacityFromEnv({ WAITING_ROOM_CAPACITY: "2" }), 2);
  for (const value of [undefined, "", "0", "-3", "1.5", "lots"]) {
    assert.equal(capacityFromEnv({ WAITING_ROOM_CAPACITY: value }), 50);
  }
});

test("leave removes only a well-formed session id", async () => {
  const removed = [];
  const handler = leaveHandler(async (id) => removed.push(id));
  const res = (status = { code: 200 }) => ({
    status(code) {
      status.code = code;
      return this;
    },
    json() {
      return this;
    },
    get code() {
      return status.code;
    },
  });
  const ok = res();
  await handler({ body: { sessionId: SESSION } }, ok);
  assert.equal(ok.code, 200);
  for (const body of [undefined, {}, { sessionId: "x" }, { sessionId: 1 }]) {
    const bad = res();
    await handler({ body }, bad);
    assert.equal(bad.code, 400);
  }
  assert.deepEqual(removed, [SESSION]);
});

test("the gate passes an admitted tab and refuses one that isn't", async () => {
  const admitted = new Set([SESSION]);
  const handler = gateHandler(async (eventId, sessionId) => eventId === 3 && admitted.has(sessionId));
  const run = async (body) => {
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
  };
  assert.equal((await run({ eventId: 3, sessionId: SESSION })).statusCode, 200);
  const early = await run({ eventId: 4, sessionId: SESSION });
  assert.equal(early.statusCode, 403);
  assert.equal(early.payload.code, "NOT_ADMITTED");
  assert.equal((await run({ eventId: 3, sessionId: "x" })).statusCode, 400);
});
