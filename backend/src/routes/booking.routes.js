const express = require("express");
const bookingController = require("../controllers/booking.controller");
const { requireTurnstile } = require("../middleware/turnstile");

const router = express.Router();

router.post("/lookup", requireTurnstile("lookup"), bookingController.lookupBooking);
router.get("/:bookingId", bookingController.getBooking);
router.post("/:bookingId/cancel", requireTurnstile("cancel"), bookingController.cancelBooking);

module.exports = router;
