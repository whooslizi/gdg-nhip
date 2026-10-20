
const supabase = require("../config/supabase");

async function createEvent(payload) {
  const { data, error } = await supabase
    .from("events")
    .insert({
      eventname: payload.eventName,
      directors: payload.directors ?? null,
      actors: payload.actors ?? null,
      types: payload.types ?? null,
      poster: payload.poster ?? null,
      duration: payload.duration,
      languages: payload.languages ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateEvent(eventId, payload) {
  const fields = {
    eventName: "eventname",
    directors: "directors",
    actors: "actors",
    types: "types",
    poster: "poster",
    duration: "duration",
    languages: "languages",
  };

  const updates = {};

  for (const [key, column] of Object.entries(fields)) {
    if (Object.hasOwn(payload, key)) {
      updates[column] = payload[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields to update");
  }

  const { data, error } = await supabase
    .from("events")
    .update(updates)
    .eq("eventid", eventId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function createShowtime(payload) {
  const { data, error } = await supabase
    .from("showtimes")
    .insert({
      eventid: payload.eventId,
      roomid: payload.roomId,
      startat: payload.startAt,
      endat: payload.endAt,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function updateShowtime(showtimeId, payload) {
  const fields = {
    eventId: "eventid",
    roomId: "roomid",
    startAt: "startat",
    endAt: "endat",
    status: "status",
  };

  const updates = {};

  for (const [key, column] of Object.entries(fields)) {
    if (Object.hasOwn(payload, key)) {
      updates[column] = payload[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields to update");
  }

  const { data, error } = await supabase
    .from("showtimes")
    .update(updates)
    .eq("showtimeid", showtimeId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = {
  createEvent,
  updateEvent,
  createShowtime,
  updateShowtime,
};
