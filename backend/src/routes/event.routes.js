const express = require("express");
const eventController = require("../controllers/event.controller");

const router = express.Router();

router.get("/", eventController.getAllEvents);
router.get("/:eventId", eventController.getEventById);
router.get("/:eventId/showtimes", eventController.getEventShowtimes);

module.exports = router;
