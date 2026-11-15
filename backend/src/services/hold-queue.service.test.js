const assert = require("node:assert/strict");
const test = require("node:test");
const { createHoldQueue, SEAT_CHANNEL } = require("./hold-queue.service");

// Stand-ins for bullmq's Queue and ioredis; they record calls instead of talking to Redis.
function fakes({ fail = false } = {}) {
  const calls = [];
  class Queue {
    constructor(name) {
      calls.push(["queue", name]);
    }
    async add(...args) {
      calls.push(["try add"]);
      if (fail) throw new Error("redis down");
      calls.push(["add", ...args]);
    }
    async remove(id) {
      if (fail) throw new Error("redis down");
      calls.push(["remove", id]);
    }
  }
  class Redis {
    constructor(_url, options) {
      calls.push(["redis", options]);
    }
    async publish(channel, message) {
      if (fail) throw new Error("redis down");
      calls.push(["publish", channel, JSON.parse(message)]);
    }
  }
  return { calls, Queue, Redis };
}

test("without REDIS_URL every function is a no-op", async () => {
  const queue = createHoldQueue({
    redisUrl: undefined,
    seatsFor: () => assert.fail("must not read the database"),
  });
  assert.equal(await queue.scheduleRelease("t", new Date().toISOString()), null);
  assert.equal(await queue.cancelRelease("t"), null);
  assert.equal(await queue.publishSeatChange({ showtimeId: 1, seatIds: [1] }, "HELD"), null);
  assert.equal(await queue.seatsForHold("t"), null);
});

test("schedules the release just after expiry, keyed by the hold token", async () => {
  const { calls, Queue, Redis } = fakes();
  const now = 1_000_000;
  const queue = createHoldQueue({ redisUrl: "redis://x", Queue, Redis, clock: () => now });

  await queue.scheduleRelease("tok", new Date(now + 600_000).toISOString());
  await queue.scheduleRelease("old", new Date(now - 5_000).toISOString());
  await queue.cancelRelease("tok");

  assert.deepEqual(calls.find(([kind]) => kind === "queue"), ["queue", "seat-holds"]);
  assert.ok(
    calls
      .filter(([kind]) => kind === "redis")
      .every(([, options]) => options.maxRetriesPerRequest === null && options.enableOfflineQueue === false)
  );
  const adds = calls.filter(([kind]) => kind === "add");
  assert.deepEqual(adds[0], [
    "add",
    "release",
    { holdToken: "tok" },
    {
      jobId: "tok",
      delay: 602_000,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  ]);
  assert.equal(adds[1][3].delay, 2_000);
  assert.deepEqual(calls.at(-1), ["remove", "tok"]);
});

test("publishes seat changes with a growing version, and skips empty ones", async () => {
  const { calls, Queue, Redis } = fakes();
  const queue = createHoldQueue({ redisUrl: "redis://x", Queue, Redis, clock: () => 42 });

  await queue.publishSeatChange({ showtimeId: 7, seatIds: [3, 4] }, "SOLD");
  await queue.publishSeatChange(null, "AVAILABLE");

  const published = calls.filter(([kind]) => kind === "publish");
  assert.deepEqual(published, [
    ["publish", SEAT_CHANNEL, { showtimeId: 7, seatIds: [3, 4], status: "SOLD", version: 42 }],
  ]);
});

test("reads the held seats for a token", async () => {
  const { Queue, Redis } = fakes();
  const queue = createHoldQueue({
    redisUrl: "redis://x",
    Queue,
    Redis,
    seatsFor: async () => [
      { showtimeid: 7, seatid: 3 },
      { showtimeid: 7, seatid: 4 },
    ],
  });
  assert.deepEqual(await queue.seatsForHold("tok"), { showtimeId: 7, seatIds: [3, 4] });
});

test("a Redis failure is logged once and never thrown", async (t) => {
  t.mock.method(console, "error", () => {});
  const { Queue, Redis } = fakes({ fail: true });
  const queue = createHoldQueue({
    redisUrl: "redis://x",
    Queue,
    Redis,
    seatsFor: async () => {
      throw new Error("db down");
    },
  });
  assert.equal(await queue.scheduleRelease("t", new Date().toISOString()), null);
  assert.equal(await queue.cancelRelease("t"), null);
  assert.equal(await queue.publishSeatChange({ showtimeId: 1, seatIds: [1] }, "HELD"), null);
  assert.equal(await queue.seatsForHold("t"), null);
  // The first failure opens the breaker, so the rest are skipped without logging.
  assert.equal(console.error.mock.callCount(), 1);
});

test("after a failure Redis is skipped for 30 s, then tried again", async (t) => {
  t.mock.method(console, "error", () => {});
  const { calls, Queue, Redis } = fakes({ fail: true });
  let now = 0;
  const queue = createHoldQueue({ redisUrl: "redis://x", Queue, Redis, clock: () => now });
  const tries = () => calls.filter(([kind]) => kind === "try add").length;

  assert.equal(await queue.scheduleRelease("t", new Date().toISOString()), null);
  assert.equal(tries(), 1);
  now = 29_999;
  assert.equal(await queue.scheduleRelease("t", new Date().toISOString()), null);
  assert.equal(tries(), 1);
  now = 30_001;
  assert.equal(await queue.scheduleRelease("t", new Date().toISOString()), null);
  assert.equal(tries(), 2);
});

test("a database error in the seat lookup does not stop Redis calls", async (t) => {
  t.mock.method(console, "error", () => {});
  const { calls, Queue, Redis } = fakes();
  const queue = createHoldQueue({
    redisUrl: "redis://x",
    Queue,
    Redis,
    seatsFor: async () => {
      throw new Error("db down");
    },
  });
  assert.equal(await queue.seatsForHold("t"), null);
  await queue.scheduleRelease("t", new Date().toISOString());
  assert.equal(calls.filter(([kind]) => kind === "add").length, 1);
});
