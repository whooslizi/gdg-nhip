const express = require("express");
const bookingController = require("../controllers/booking.controller");

const router = express.Router();

router.post("/lookup", bookingController.lookupBooking);
router.get("/:bookingId", bookingController.getBooking);
router.post("/:bookingId/cancel", bookingController.cancelBooking);

module.exports = router;
