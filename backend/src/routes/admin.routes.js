const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const adminController = require("../controllers/admin.controller");
const adminAuthController = require("../controllers/admin-auth.controller");

// Coarse per-IP cap on top of the login lockout in admin-auth.service.
router.use(rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }));

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
