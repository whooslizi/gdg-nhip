
const supabase = require("../config/supabase");

async function getShowtimeById(showtimeId) {
  const { data, error } = await supabase
    .from("showtimes")
    .select("showtimeid, eventid, roomid, startat, endat")
    .eq("showtimeid", showtimeId)
    .maybeSingle();

  if (error) {
    console.error("Supabase query failed:", error);
    throw error;
  }

  return data;
}

async function getShowtimeSeats(showtimeId) {
  const { data: showtime, error: showtimeError } = await supabase
    .from("showtimes")
    .select("showtimeid, eventid, roomid")
    .eq("showtimeid", showtimeId)
    .maybeSingle();

  if (showtimeError) throw showtimeError;
  if (!showtime) return null;

  const { data: seats, error: seatsError } = await supabase
    .from("seats")
    .select("seatid, rowlabel, seatnumber, seattype")
    .order("rowlabel")
    .order("seatnumber");

  if (seatsError) throw seatsError;

  const { data: states, error: statesError } = await supabase
    .from("showtime_seats")
    .select("seatid, status, holdexpiresat")
    .eq("showtimeid", showtimeId);

  if (statesError) throw statesError;

  const stateMap = new Map(
    states.map((item) => [item.seatid, item])
  );

  const now = Date.now();

  return {
    eventId: showtime.eventid,
    showtimeId: showtime.showtimeid,
    roomId: showtime.roomid,

    seats: seats.map((seat) => {
      const state = stateMap.get(seat.seatid);

      const isExpired =
        state?.status === "holding" &&
        state.holdexpiresat != null &&
        new Date(state.holdexpiresat).getTime() <= now;

      let status = state?.status ?? "available";

      if (isExpired) {
        status = "available";
      }

      return {
        seatId: seat.seatid,
        rowLabel: seat.rowlabel,
        seatNumber: seat.seatnumber,
        seatType: seat.seattype,
        status,
      };
    }),
  };
}

module.exports = {
  getShowtimeById,
  getShowtimeSeats,
};
