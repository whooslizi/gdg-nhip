const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.controller");

router.post("/events", adminController.createEvent);
router.patch("/events/:eventId", adminController.updateEvent);

router.post("/showtimes", adminController.createShowtime);
router.patch(
  "/showtimes/:showtimeId",
  adminController.updateShowtime
);

module.exports = router;
