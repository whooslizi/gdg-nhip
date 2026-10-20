const express = require("express");
const showtimeController = require("../controllers/showtime.controller");

const router = express.Router();

router.get("/:showtimeId", showtimeController.getShowtimeById);
router.get("/:showtimeId/seats", showtimeController.getShowtimeSeats);

module.exports = router;