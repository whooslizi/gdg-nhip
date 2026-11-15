const { redis, supabase, QUEUE_NAME, SEAT_CHANNEL } = require("./redis");

// Runs the delayed "release" job the backend adds for every hold. release_expired_hold only
// frees seats still held under the token and already expired, so a retry or a hold that was
// paid or cancelled meanwhile changes nothing. `heldSeats(token)` returns the seats still held
// under the token with their holdexpiresat.
function releaseHandler({ rpc, publish, heldSeats, clock = Date.now }) {
  return async function release(job) {
    const { data, error } = await rpc("release_expired_hold", { p_hold_token: job.data.holdToken });
    if (error) throw error;
    if (!(data?.released > 0)) {
      // Nothing freed: either the hold is gone (paid, cancelled, already freed) and the job is
      // done, or it ran before expiry (clock skew) and BullMQ should retry it with backoff.
      const seats = await heldSeats(job.data.holdToken);
      if (seats.some((seat) => Date.parse(seat.holdexpiresat) > clock())) {
        throw new Error("Hold has not expired yet");
      }
      return data;
    }
    await publish(
      JSON.stringify({ showtimeId: data.showtimeId, seatIds: data.seatIds, status: "AVAILABLE", version: clock() })
    );
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
      heldSeats: async (holdToken) => {
        const { data, error } = await db
          .from("showtime_seats")
          .select("seatid, holdexpiresat")
          .eq("holdtoken", holdToken)
          .eq("status", "holding");
        if (error) throw error;
        return data;
      },
    }),
    { connection: redis() }
  );
  worker.on("failed", (job, error) => console.error(`Release ${job?.id} failed:`, error.message));
  console.log(`Worker listening on queue "${QUEUE_NAME}"`);
}

if (require.main === module) start();

module.exports = { releaseHandler };
