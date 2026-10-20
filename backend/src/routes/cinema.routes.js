const express = require("express");
const cinemaController = require("../controllers/cinema.controller");

const router = express.Router();

router.get("/:cinemaId", cinemaController.getCinemaById);
router.get("/:cinemaId/rooms", cinemaController.getCinemaRooms);

module.exports = router;