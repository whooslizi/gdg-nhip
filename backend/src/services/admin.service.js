
const supabase = require("../config/supabase");

async function createArea(areaName) {
  const { data, error } = await supabase
    .from("areas")
    .insert({ areaname: areaName })
    .select("areaid, areaname")
    .single();

  if (error) throw error;
  return data;
}

async function createCinema({ cinemaName, areaId, locate }) {
  const { data, error } = await supabase
    .from("cinemas")
    .insert({ cinemaname: cinemaName, areaid: areaId, locate })
    .select("cinemaid, cinemaname, areaid, locate")
    .single();

  if (error) throw error;
  return data;
}

async function createRoom({ roomName, cinemaId }) {
  const { data, error } = await supabase
    .from("rooms")
    .insert({ roomname: roomName, cinemaid: cinemaId })
    .select("roomid, roomname, cinemaid")
    .single();

  if (error) throw error;
  return data;
}

async function deleteArea(areaId) {
  const { data, error } = await supabase
    .from("areas")
    .delete()
    .eq("areaid", areaId)
    .select("areaid")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function deleteCinema(cinemaId) {
  const { data, error } = await supabase
    .from("cinemas")
    .delete()
    .eq("cinemaid", cinemaId)
    .select("cinemaid")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function deleteRoom(roomId) {
  const { data, error } = await supabase
    .from("rooms")
    .delete()
    .eq("roomid", roomId)
    .select("roomid")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function createEvent(payload) {
  const { data, error } = await supabase
    .from("events")
    .insert({
      eventname: payload.eventName,
      directors: payload.directors ?? [],
      actors: payload.actors ?? [],
      types: payload.types ?? [],
      poster: payload.poster,
      duration: payload.duration,
      languages: payload.languages ?? [],
      startat: payload.startAt,
      endat: payload.endAt
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
    startAt: "startat",
    endAt: "endat"
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
      status: payload.status,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function getShowtime(showtimeId) {
  const { data, error } = await supabase
    .from("showtimes")
    .select("showtimeid, startat, endat")
    .eq("showtimeid", showtimeId)
    .maybeSingle();

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
  createArea,
  createCinema,
  createRoom,
  deleteArea,
  deleteCinema,
  deleteRoom,
  createEvent,
  updateEvent,
  createShowtime,
  getShowtime,
  updateShowtime,
};
