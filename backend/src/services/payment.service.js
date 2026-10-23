
const supabase = require("../config/supabase");

async function processMockPayment({
  holdToken,
  userName,
  userPhone,
  userEmail,
  price,
  result,
}) {
  const expectedPrice = await heldSeatsPrice(holdToken);
  if (price !== expectedPrice) throw new Error("Price does not match the held seats");

  const { data, error } = await supabase.rpc("process_mock_payment", {
    p_hold_token: holdToken,
    p_user_name: userName,
    p_user_phone: userPhone,
    p_user_email: userEmail,
    p_price: price,
    p_result: result,
  });

  if (error) {
    console.error("Mock payment failed:", error);
    throw error;
  }

  return data;
}

async function getPaymentById(paymentId) {
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("paymentid, bookingid, method, createdat")
    .eq("paymentid", paymentId)
    .maybeSingle();

  if (paymentError) throw paymentError;
  if (!payment) return null;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "bookingid, username, userphone, useremail, price, status"
    )
    .eq("bookingid", payment.bookingid)
    .single();

  if (bookingError) throw bookingError;

  const { data: showtimeSeats, error: seatsError } = await supabase
    .from("showtime_seats")
    .select("showtimeid, seatid")
    .eq("bookingid", booking.bookingid)
    .eq("status", "booked");

  if (seatsError) throw seatsError;

  if (!showtimeSeats || showtimeSeats.length === 0) {
    return {
      paymentId: payment.paymentid,
      userName: booking.username,
      userEmail: booking.useremail,
      method: payment.method,
      createdAt: payment.createdat,
      price: booking.price,
      seats: [],
      eventId: null,
      startAt: null,
      endAt: null,
    };
  }

  const showtimeId = showtimeSeats[0].showtimeid;
  const seatIds = showtimeSeats.map((item) => item.seatid);
  const [
    { data: seats, error: seatDetailsError },
    { data: showtime, error: showtimeError },
  ] = await Promise.all([
    supabase
      .from("seats")
      .select("seatid, rowlabel, seatnumber, seattype")
      .in("seatid", seatIds),

    supabase
      .from("showtimes")
      .select("showtimeid, eventid, startat, endat")
      .eq("showtimeid", showtimeId)
      .single(),
  ]);

  if (seatDetailsError) throw seatDetailsError;
  if (showtimeError) throw showtimeError;

  if (showtimeSeats.some((item) => item.showtimeid !== showtimeId)) {
    throw new Error("Booking contains seats from multiple showtimes");
  }

  return {
    paymentId: payment.paymentid,
    userName: booking.username,
    userEmail: booking.useremail,
    method: payment.method,
    createdAt: payment.createdat,
    seats: seats.map((seat) => ({
      seatId: seat.seatid,
      rowLabel: seat.rowlabel,
      seatNumber: seat.seatnumber,
      seatType: seat.seattype,
    })),
    price: booking.price,
    eventId: showtime.eventid,
    startAt: showtime.startat,
    endAt: showtime.endat,
  };
}

function seatPrice(seatType) {
  switch (String(seatType).trim().toLowerCase()) {
    case "standard":
    case "normal":
      return 150000;
    case "vip":
      return 250000;
    default:
      return 0;
  }
}

async function heldSeatsPrice(holdToken) {
  const { data: held, error } = await supabase
    .from("showtime_seats")
    .select("seatid")
    .eq("holdtoken", holdToken)
    .eq("status", "holding");
  if (error) throw error;
  if (!held?.length) throw new Error("Hold token is invalid or expired");

  const { data: seats, error: seatsError } = await supabase
    .from("seats")
    .select("seatid, seattype")
    .in("seatid", held.map((item) => item.seatid));
  if (seatsError) throw seatsError;

  const prices = seats.map((seat) => seatPrice(seat.seattype));
  if (prices.length !== held.length || prices.includes(0)) {
    throw new Error("Some held seats have no configured price");
  }
  return prices.reduce((total, value) => total + value, 0);
}

function eventSlug(eventName) {
  return String(eventName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function findBookingRecord(bookingReference) {
  const reference = String(bookingReference).trim();
  const { data: codedBooking, error: codeError } = await supabase
    .from("bookings")
    .select("bookingid, bookingcode, username, userphone, useremail, price, status")
    .eq("bookingcode", reference.toUpperCase())
    .maybeSingle();

  if (codeError) throw codeError;
  if (codedBooking) return codedBooking;

  if (!/^\d+$/.test(reference)) return null;
  const legacyId = Number(reference);
  if (!Number.isSafeInteger(legacyId) || legacyId <= 0) return null;

  const { data, error } = await supabase
    .from("bookings")
    .select("bookingid, bookingcode, username, userphone, useremail, price, status")
    .eq("bookingid", legacyId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getBookingById(bookingReference, userEmail) {
  const booking = await findBookingRecord(bookingReference);
  if (!booking || booking.useremail.toLowerCase() !== userEmail.trim().toLowerCase()) {
    return null;
  }

  const bookingId = booking.bookingid;

  const [
    { data: payment, error: paymentError },
    { data: bookedSeats, error: bookedSeatsError },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("paymentid, createdat")
      .eq("bookingid", bookingId)
      .order("createdat", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("booking_seats")
      .select("showtimeid, seatid, rowlabel, seatnumber, seattype")
      .eq("bookingid", bookingId)
      .order("seatid"),
  ]);

  if (paymentError) throw paymentError;
  if (bookedSeatsError) throw bookedSeatsError;

  let event = null;
  let startAt = null;
  let venue = null;
  if (bookedSeats?.length) {
    const showtimeId = bookedSeats[0].showtimeid;
    if (bookedSeats.some((seat) => seat.showtimeid !== showtimeId)) {
      throw new Error("Booking contains seats from multiple showtimes");
    }

    const { data: showtime, error: showtimeError } = await supabase
      .from("showtimes")
      .select("eventid, roomid, startat")
      .eq("showtimeid", showtimeId)
      .maybeSingle();
    if (showtimeError) throw showtimeError;

    if (showtime) {
      startAt = showtime.startat;
      const [{ data: eventData, error: eventError }, { data: room, error: roomError }] =
        await Promise.all([
          supabase
            .from("events")
            .select("eventid, eventname, poster")
            .eq("eventid", showtime.eventid)
            .maybeSingle(),
          supabase
            .from("rooms")
            .select("roomname, cinemaid")
            .eq("roomid", showtime.roomid)
            .maybeSingle(),
        ]);
      if (eventError) throw eventError;
      if (roomError) throw roomError;

      if (eventData) {
        event = {
          slug: eventSlug(eventData.eventname),
          title: eventData.eventname,
          posterUrl: eventData.poster,
          startAt,
          venue: null,
          city: null,
        };
      }
      if (room) {
        const { data: cinema, error: cinemaError } = await supabase
          .from("cinemas")
          .select("cinemaname, locate")
          .eq("cinemaid", room.cinemaid)
          .maybeSingle();
        if (cinemaError) throw cinemaError;
        if (cinema) venue = `${cinema.cinemaname} · ${room.roomname}`;
      }
    }
  }

  return {
    id: booking.bookingcode ?? String(booking.bookingid),
    reference: booking.bookingcode ?? String(booking.bookingid),
    accessCode: "",
    email: booking.useremail,
    status: booking.status.toUpperCase(),
    event: event ?? {
      slug: "",
      title: "Booking",
      posterUrl: null,
      startAt,
      venue,
      city: null,
    },
    items: (bookedSeats ?? []).map((seat) => ({
      seatLabel: `${seat.rowlabel}${seat.seatnumber}`,
      section: venue ?? "",
      ticketType: seat.seattype,
      unitPriceMinor: seatPrice(seat.seattype),
    })),
    totalMinor: Number(booking.price),
    currency: "VND",
    confirmedAt: payment?.createdat ?? null,
    ...(booking.status === "cancelled" && { refundMinor: Number(booking.price) }),
  };
}

async function cancelBooking(bookingReference, userEmail) {
  const booking = await findBookingRecord(bookingReference);
  if (!booking || booking.useremail.toLowerCase() !== userEmail.trim().toLowerCase()) {
    throw new Error("Booking not found");
  }

  const { data, error } = await supabase.rpc("cancel_booking", {
    p_booking_id: booking.bookingid,
    p_user_email: userEmail,
  });

  if (error) throw error;
  return data;
}

module.exports = {
  processMockPayment,
  getPaymentById,
  getBookingById,
  cancelBooking,
};
