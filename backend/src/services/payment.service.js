
const crypto = require("node:crypto");
const supabase = require("../config/supabase");
const { createTicketTokenService } = require("./ticket-token.service");

const ticketTokens = createTicketTokenService();

// The door QR: only for a confirmed booking, signed on the server, null if no key is set.
// Codes from the first booking-code migration can be malformed; those get no QR rather than an error.
function ticketTokenFor(booking, showtimeId) {
  if (booking.status !== "confirmed" || !booking.bookingcode || !showtimeId) return null;
  try {
    return ticketTokens.sign({ code: booking.bookingcode, showtimeId, version: booking.qrversion });
  } catch {
    return null;
  }
}

// Same alphabet and XXXX-XXXX shape as booking codes and the mock API's cancelCode.
const CANCEL_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CANCEL_CODE = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

function newCancelCode() {
  const pick = () => CANCEL_ALPHABET[crypto.randomInt(CANCEL_ALPHABET.length)];
  const group = () => Array.from({ length: 4 }, pick).join("");
  return `${group()}-${group()}`;
}

const sha256 = (salt, code) => crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");

// Stored as "salt:hash"; the plain code is never written to the database.
function hashCancelCode(code) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${sha256(salt, code)}`;
}

function cancelCodeMatches(code, stored) {
  const [salt, expected] = String(stored).split(":");
  if (!salt || !expected || !CANCEL_CODE.test(code)) return false;
  const given = Buffer.from(sha256(salt, code), "hex");
  const wanted = Buffer.from(expected, "hex");
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}

const codedError = (code, message) => Object.assign(new Error(message), { code });

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

  const cancelCode = newCancelCode();
  const { data, error } = await supabase.rpc("process_mock_payment", {
    p_hold_token: holdToken,
    p_user_name: userName,
    p_user_phone: userPhone,
    p_user_email: userEmail,
    p_price: price,
    p_result: result,
    p_cancel_code_hash: hashCancelCode(cancelCode),
  });

  if (error) {
    console.error("Mock payment failed:", error);
    throw error;
  }

  // The only time the plain code leaves the server.
  return data?.success && data.data ? { ...data, data: { ...data.data, cancelCode } } : data;
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

// Zone tickets carry their own price; hall seats are priced by type.
function seatPrice(seatType, price = null) {
  if (price !== null && price !== undefined) return Number(price);
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
    .select("seatid, seattype, price")
    .in("seatid", held.map((item) => item.seatid));
  if (seatsError) throw seatsError;

  const prices = seats.map((seat) => seatPrice(seat.seattype, seat.price));
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

// Only BK-XXXX-XXXX codes; the sequential bookingid is never accepted from the public.
async function findBookingRecord(bookingCode) {
  const { data, error } = await supabase
    .from("bookings")
    .select("bookingid, bookingcode, username, userphone, useremail, price, status, qrversion, checkedinat, checkedinby, cancel_code_hash")
    .eq("bookingcode", String(bookingCode).trim().toUpperCase())
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
      .select("showtimeid, seatid, rowlabel, seatnumber, seattype, seats(layout, price)")
      .eq("bookingid", bookingId)
      .order("seatid"),
  ]);

  if (paymentError) throw paymentError;
  if (bookedSeatsError) throw bookedSeatsError;

  let event = null;
  let showtimeId = null;
  let startAt = null;
  let endAt = null;
  let venue = null;
  if (bookedSeats?.length) {
    showtimeId = bookedSeats[0].showtimeid;
    if (bookedSeats.some((seat) => seat.showtimeid !== showtimeId)) {
      throw new Error("Booking contains seats from multiple showtimes");
    }

    const { data: showtime, error: showtimeError } = await supabase
      .from("showtimes")
      .select("eventid, roomid, startat, endat")
      .eq("showtimeid", showtimeId)
      .maybeSingle();
    if (showtimeError) throw showtimeError;

    if (showtime) {
      startAt = showtime.startat;
      endAt = showtime.endat;
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
          endAt,
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
    event: event ? { ...event, venue } : {
      slug: "",
      title: "Booking",
      posterUrl: null,
      startAt,
      endAt,
      venue,
      city: null,
    },
    items: (bookedSeats ?? []).map((seat) => ({
      // A zone ticket reads "GOLD 1 · #12"; a hall seat keeps its row and number.
      seatLabel: seat.seats?.layout && seat.seats.layout !== "hall"
        ? `${seat.seattype} · #${seat.seatnumber}`
        : `${seat.rowlabel}${seat.seatnumber}`,
      section: venue ?? "",
      ticketType: seat.seattype,
      unitPriceMinor: seatPrice(seat.seattype, seat.seats?.price),
    })),
    totalMinor: Number(booking.price),
    ticketToken: ticketTokenFor(booking, showtimeId),
    currency: "VND",
    confirmedAt: payment?.createdat ?? null,
    checkedInAt: booking.checkedinat ?? null,
    checkedInBy: booking.checkedinby ?? null,
    ...(booking.status === "cancelled" && { refundMinor: Number(booking.price) }),
  };
}

async function cancelBooking(bookingCode, cancelCode) {
  const booking = await findBookingRecord(bookingCode);
  if (!booking) throw new Error("Booking not found");
  // Bookings from before cancel codes existed have no hash; only organisers can cancel those.
  if (!booking.cancel_code_hash) {
    throw codedError("CANCEL_NOT_AVAILABLE", "This booking can only be cancelled by the organisers");
  }
  if (!cancelCodeMatches(String(cancelCode).trim().toUpperCase(), booking.cancel_code_hash)) {
    throw codedError("INVALID_CANCEL_CODE", "Wrong cancellation code");
  }

  const { error } = await supabase.rpc("cancel_booking", {
    p_booking_id: booking.bookingid,
    p_user_email: booking.useremail,
  });

  if (error) throw error;
  return getBookingById(booking.bookingcode, booking.useremail);
}

module.exports = {
  processMockPayment,
  getPaymentById,
  getBookingById,
  cancelBooking,
};
