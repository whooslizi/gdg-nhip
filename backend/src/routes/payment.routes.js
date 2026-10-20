const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/payment.controller");

router.post("/mock", paymentController.createMockPayment);
router.get("/:paymentId", paymentController.getPayment);

module.exports = router;
