const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.controller");
const adminAuthController = require("../controllers/admin-auth.controller");

router.post("/login", adminAuthController.login);
router.get("/session", adminAuthController.requireAdmin, adminAuthController.getSession);
router.use(adminAuthController.requireAdmin);

router.post("/areas", adminController.createArea);
router.delete("/areas/:areaId", adminController.deleteArea);
router.post("/cinemas", adminController.createCinema);
router.delete("/cinemas/:cinemaId", adminController.deleteCinema);
router.post("/rooms", adminController.createRoom);
router.delete("/rooms/:roomId", adminController.deleteRoom);

router.post("/events", adminController.createEvent);
router.patch("/events/:eventId", adminController.updateEvent);

router.post("/showtimes", adminController.createShowtime);
router.patch(
  "/showtimes/:showtimeId",
  adminController.updateShowtime
);

module.exports = router;
