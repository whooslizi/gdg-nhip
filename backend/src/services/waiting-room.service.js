const supabase = require("../config/supabase");

async function waitingRoom(eventId, sessionId, join, capacity) {
  const { data, error } = await supabase.rpc("waiting_room", {
    p_event_id: eventId,
    p_session_id: sessionId,
    p_join: join,
    p_capacity: capacity,
  });

  if (error) throw error;
  return data;
}

async function leaveWaitingRoom(sessionId) {
  const { error } = await supabase.from("waiting_room").delete().eq("sessionid", sessionId);
  if (error) throw error;
}

async function passGate(eventId, sessionId) {
  const { data, error } = await supabase.rpc("waiting_room_pass_gate", {
    p_event_id: eventId,
    p_session_id: sessionId,
  });
  if (error) throw error;
  return data === true;
}

async function mayHold(sessionId, showtimeId) {
  const { data, error } = await supabase.rpc("waiting_room_may_hold", {
    p_session_id: sessionId,
    p_showtime_id: showtimeId,
  });
  if (error) throw error;
  return data === true;
}

module.exports = { waitingRoom, leaveWaitingRoom, passGate, mayHold };
