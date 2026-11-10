const paymentService = require("../services/payment.service");

// Only random BK codes: sequential database IDs would let anyone walk through bookings.
function parseBookingId(value) {
  if (typeof value !== "string") return null;
  const reference = value.trim().toUpperCase();
  return /^BK-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(reference) ? reference : null;
}

function sendBookingError(res, error) {
  const message = error.message || "Could not process booking request";
  if (error.code === "INVALID_CANCEL_CODE" || error.code === "CANCEL_NOT_AVAILABLE") {
    return res.status(403).json({ success: false, code: error.code, message });
  }
  if (message.includes("Booking not found")) {
    return res.status(404).json({ success: false, message: "Booking not found" });
  }
  if (message.includes("already cancelled")) {
    return res.status(409).json({ success: false, message: "Booking is already cancelled" });
  }
  if (message.includes("Only confirmed bookings")) {
    return res.status(409).json({ success: false, message });
  }
  console.error("Booking API error:", error);
  return res.status(500).json({ success: false, message: "Could not process booking request" });
}

async function getBooking(req, res) {
  const bookingId = parseBookingId(req.params.bookingId);
  const userEmail = req.query.email;
  if (!bookingId || typeof userEmail !== "string" || !userEmail.trim()) {
    return res.status(400).json({
      success: false,
      message: "A valid bookingId and email are required",
    });
  }

  try {
    const booking = await paymentService.getBookingById(bookingId, userEmail);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    return sendBookingError(res, error);
  }
}

async function lookupBooking(req, res) {
  const bookingId = parseBookingId(req.body?.bookingId);
  const userEmail = req.body?.email;
  if (!bookingId || typeof userEmail !== "string" || !userEmail.trim()) {
    return res.status(400).json({
      success: false,
      message: "A valid bookingId and email are required",
    });
  }

  try {
    const booking = await paymentService.getBookingById(bookingId, userEmail);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    return sendBookingError(res, error);
  }
}

async function cancelBooking(req, res) {
  const bookingId = parseBookingId(req.params.bookingId);
  const cancelCode = req.body?.cancelCode;
  if (!bookingId || typeof cancelCode !== "string" || !cancelCode.trim() || cancelCode.length > 32) {
    return res.status(400).json({
      success: false,
      message: "A valid bookingId and cancelCode are required",
    });
  }

  try {
    const booking = await paymentService.cancelBooking(bookingId, cancelCode);
    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    return sendBookingError(res, error);
  }
}

module.exports = { getBooking, lookupBooking, cancelBooking };
