const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CAPACITY = 50;

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
      console.error("Waiting room gate failed:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
}

module.exports = { waitingRoomHandler, leaveHandler, gateHandler, capacityFromEnv, UUID };
