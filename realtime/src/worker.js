const { redis, supabase, QUEUE_NAME, SEAT_CHANNEL } = require("./redis");

// Runs the delayed "release" job the backend adds for every hold. release_expired_hold only
// frees seats still held under the token and already expired, so a retry or a hold that was
// paid or cancelled meanwhile changes nothing.
function releaseHandler({ rpc, publish, clock = Date.now }) {
  return async function release(job) {
    const { data, error } = await rpc("release_expired_hold", { p_hold_token: job.data.holdToken });
    if (error) throw error;
    if (data?.released > 0) {
      await publish(
        JSON.stringify({ showtimeId: data.showtimeId, seatIds: data.seatIds, status: "AVAILABLE", version: clock() })
      );
    }
    return data;
  };
}

function start() {
  const { Worker } = require("bullmq");
  const db = supabase();
  const publisher = redis();
  const worker = new Worker(
    QUEUE_NAME,
    releaseHandler({
      rpc: (name, args) => db.rpc(name, args),
      publish: (message) => publisher.publish(SEAT_CHANNEL, message),
    }),
    { connection: redis() }
  );
  worker.on("failed", (job, error) => console.error(`Release ${job?.id} failed:`, error.message));
  console.log(`Worker listening on queue "${QUEUE_NAME}"`);
}

if (require.main === module) start();

module.exports = { releaseHandler };
