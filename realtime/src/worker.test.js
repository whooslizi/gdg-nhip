const assert = require("node:assert/strict");
const test = require("node:test");

// redis.js loads dotenv, ioredis and supabase-js but connects to nothing until called.
const { releaseHandler } = require("./worker");

const job = { data: { holdToken: "tok" } };

test("publishes a seat change only when seats were released", async () => {
  const published = [];
  const replies = [
    { released: 2, showtimeId: 7, seatIds: [3, 4] },
    { released: 0, showtimeId: null, seatIds: [] },
  ];
  const calls = [];
  const release = releaseHandler({
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: replies.shift(), error: null };
    },
    publish: async (message) => published.push(JSON.parse(message)),
    heldSeats: async () => [],
    clock: () => 99,
  });

  await release(job);
  await release(job); // a retry, or a hold already paid: nothing left to free, the job completes
  assert.deepEqual(calls[0], ["release_expired_hold", { p_hold_token: "tok" }]);
  assert.deepEqual(published, [{ showtimeId: 7, seatIds: [3, 4], status: "AVAILABLE", version: 99 }]);
});

test("a database error fails the job so BullMQ records it", async () => {
  const release = releaseHandler({
    rpc: async () => ({ data: null, error: new Error("db down") }),
    publish: async () => assert.fail("must not publish"),
  });
  await assert.rejects(release(job), /db down/);
});

test("a job that ran before the hold expired fails so BullMQ retries it", async () => {
  const now = Date.parse("2026-11-15T10:00:00Z");
  const release = releaseHandler({
    rpc: async () => ({ data: { released: 0, showtimeId: null, seatIds: [] }, error: null }),
    publish: async () => assert.fail("must not publish"),
    heldSeats: async () => [{ seatid: 3, holdexpiresat: "2026-11-15T10:00:05Z" }],
    clock: () => now,
  });
  await assert.rejects(release(job), /not expired yet/);
});

test("nothing released and nothing held completes without publishing", async () => {
  const release = releaseHandler({
    rpc: async () => ({ data: { released: 0, showtimeId: null, seatIds: [] }, error: null }),
    publish: async () => assert.fail("must not publish"),
    heldSeats: async () => [],
  });
  assert.deepEqual(await release(job), { released: 0, showtimeId: null, seatIds: [] });
});
