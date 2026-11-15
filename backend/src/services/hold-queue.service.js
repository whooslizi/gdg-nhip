// Optional speed-up on top of lazy expiry: with REDIS_URL set, every hold gets a delayed BullMQ
// job that frees its seats right after they expire (realtime/src/worker.js), and seat changes
// go out on a Redis channel for the realtime server to push to open seat maps. Without
// REDIS_URL every function is a no-op. Nothing here ever throws: a hold or payment must not
// fail because Redis is down, since holdexpiresat <= now() still frees the seats.

const QUEUE_NAME = "seat-holds";
const SEAT_CHANNEL = "nhip:seat-changes";
const GRACE_MS = 2000;
const TIMEOUT_MS = 1500;

// `Queue`, `Redis` and `seatsFor` are injectable for tests; the real ones load only when used.
function createHoldQueue({
  redisUrl = process.env.REDIS_URL,
  Queue,
  Redis,
  seatsFor,
  clock = Date.now,
} = {}) {
  if (!redisUrl) {
    const noop = async () => null;
    return { scheduleRelease: noop, cancelRelease: noop, publishSeatChange: noop, seatsForHold: noop };
  }

  let queue;
  let publisher;
  const connect = () => {
    if (!queue) {
      Queue ??= require("bullmq").Queue;
      Redis ??= require("ioredis");
      publisher = new Redis(redisUrl, { maxRetriesPerRequest: null });
      queue = new Queue(QUEUE_NAME, { connection: new Redis(redisUrl, { maxRetriesPerRequest: null }) });
    }
    return { queue, publisher };
  };

  // maxRetriesPerRequest: null makes ioredis wait forever while Redis is down, so cap the wait.
  const guard = (name, fn) => async (...args) => {
    let timer;
    try {
      return await Promise.race([
        fn(...args),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timed out")), TIMEOUT_MS);
        }),
      ]);
    } catch (error) {
      console.error(`Hold queue ${name} failed:`, error.message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    scheduleRelease: guard("schedule", (holdToken, expiresAt) =>
      connect().queue.add(
        "release",
        { holdToken },
        {
          jobId: holdToken,
          delay: Math.max(0, Date.parse(expiresAt) - clock()) + GRACE_MS,
          removeOnComplete: true,
          removeOnFail: 100,
        }
      )
    ),
    cancelRelease: guard("cancel", (holdToken) => connect().queue.remove(holdToken)),
    // `version` only has to grow: the REST seat map starts every seat at 1.
    publishSeatChange: guard("publish", (seats, status) =>
      seats?.seatIds?.length
        ? connect().publisher.publish(
            SEAT_CHANNEL,
            JSON.stringify({ showtimeId: seats.showtimeId, seatIds: seats.seatIds, status, version: clock() })
          )
        : null
    ),
    // Read before cancel/payment: both clear holdtoken, so the seats can't be found afterwards.
    seatsForHold: guard("lookup", async (holdToken) => {
      const rows = await (seatsFor ?? require("./hold.service").seatsForHold)(holdToken);
      return rows.length ? { showtimeId: rows[0].showtimeid, seatIds: rows.map((row) => row.seatid) } : null;
    }),
  };
}

module.exports = { createHoldQueue, holdQueue: createHoldQueue(), QUEUE_NAME, SEAT_CHANNEL };
