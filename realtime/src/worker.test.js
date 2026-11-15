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
    clock: () => 99,
  });

  await release(job);
  await release(job); // a retry, or a hold already paid: nothing left to free
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
