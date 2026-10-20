
const paymentService = require("../services/payment.service");

async function createMockPayment(req, res) {
  try {
    const {
      holdToken,
      userName,
      userPhone,
      userEmail,
      price,
      result,
    } = req.body;

    if (
      typeof holdToken !== "string" ||
      !holdToken.trim() ||
      typeof userName !== "string" ||
      !userName.trim() ||
      typeof userPhone !== "string" ||
      !userPhone.trim() ||
      typeof userEmail !== "string" ||
      !userEmail.trim() ||
      !Number.isSafeInteger(price) ||
      price < 0 ||
      !["success", "failed"].includes(result)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment input",
      });
    }

    const data = await paymentService.processMockPayment({
      holdToken,
      userName: userName.trim(),
      userPhone: userPhone.trim(),
      userEmail: userEmail.trim(),
      price,
      result,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error("Create mock payment error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Could not process payment",
    });
  }
}

async function getPayment(req, res) {
  try {
    const paymentId = Number(req.params.paymentId);

    if (!Number.isSafeInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid paymentId",
      });
    }

    const payment = await paymentService.getPaymentById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Get payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve payment",
    });
  }
}

module.exports = {
  createMockPayment,
  getPayment,
};
