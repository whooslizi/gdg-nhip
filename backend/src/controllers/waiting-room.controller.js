const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CAPACITY = 50;

// The waiting-room migrations haven't been run: missing function (PGRST202), table (PGRST205,
// 42P01), column (42703) or signature (42883). Say so instead of a bare 500.
const MISSING_SCHEMA = new Set(["PGRST202", "PGRST205", "42P01", "42703", "42883"]);
function queueNotSetUp(res, error) {
  if (!MISSING_SCHEMA.has(error?.code)) return false;
  console.error("Waiting room tables/functions are missing; run the waiting_room migrations:", error.message);
  res.status(503).json({
    success: false,
    code: "QUEUE_NOT_SET_UP",
    message: "The waiting room is not set up on the server yet",
  });
  return true;
}

function capacityFromEnv(env = process.env) {
  const value = Number(env.WAITING_ROOM_CAPACITY);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_CAPACITY;
}

// `rpc` is injected so tests don't need Supabase. `join` adds the tab to the queue;
// otherwise the call is a heartbeat for a tab that is already in it.
function waitingRoomHandler(rpc, join, getCapacity = capacityFromEnv) {
  return async function waitingRoom(req, res) {
    const { eventId, sessionId } = req.body ?? {};
    if (!Number.isInteger(eventId) || eventId <= 0 || typeof sessionId !== "string" || !UUID.test(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "eventId must be a positive integer and sessionId a UUID",
      });
    }

    try {
      const data = await rpc(eventId, sessionId, join, getCapacity());
      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error?.code === "23503") {
        return res.status(404).json({ success: false, code: "EVENT_NOT_FOUND", message: "Event not found" });
      }
      if (queueNotSetUp(res, error)) return res;
      console.error("Waiting room failed:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
}

// Lets a tab give its place back on the way out. Session ids are random per visit, so only
// that tab knows its own.
function leaveHandler(remove) {
  return async function leaveWaitingRoom(req, res) {
    const { sessionId } = req.body ?? {};
    if (typeof sessionId !== "string" || !UUID.test(sessionId)) {
      return res.status(400).json({ success: false, message: "sessionId must be a UUID" });
    }
    try {
      await remove(sessionId);
      return res.status(200).json({ success: true, data: null });
    } catch (error) {
      console.error("Leaving the waiting room failed:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
}

// The gate to the seat map: mounted behind requireTurnstile("gate"), so reaching this means a
// human check passed; the database then records it if this tab really is admitted.
function gateHandler(passGate) {
  return async function passWaitingRoomGate(req, res) {
    const { eventId, sessionId } = req.body ?? {};
    if (!Number.isInteger(eventId) || eventId <= 0 || typeof sessionId !== "string" || !UUID.test(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "eventId must be a positive integer and sessionId a UUID",
      });
    }
    try {
      if (!(await passGate(eventId, sessionId))) {
        return res.status(403).json({ success: false, code: "NOT_ADMITTED", message: "It is not your turn yet" });
      }
      return res.status(200).json({ success: true, data: { passed: true } });
    } catch (error) {
      if (queueNotSetUp(res, error)) return res;
      console.error("Waiting room gate failed:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
}

module.exports = { waitingRoomHandler, leaveHandler, gateHandler, capacityFromEnv, queueNotSetUp, UUID };
