const express = require("express");
const cors = require("cors");

const eventRoutes = require("./routes/event.routes");
const areaRoutes = require("./routes/area.routes");
const cinemaRoutes = require("./routes/cinema.routes");
const showtimeRoutes = require("./routes/showtime.routes");
const holdRoutes = require("./routes/hold.routes");
const paymentRoutes = require("./routes/payment.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

app.use(express.json());
app.use("/api/events", eventRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/cinemas", cinemaRoutes);
app.use("/api/showtimes", showtimeRoutes);
app.use("/api/holds", holdRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

module.exports = app;
