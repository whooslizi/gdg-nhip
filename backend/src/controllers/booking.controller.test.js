const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const servicePath = path.resolve(__dirname, "../services/payment.service.js");
const service = {
  getBookingById: async (bookingId, email) => ({ id: String(bookingId), email }),
  cancelBooking: async (bookingId, email) => ({ bookingId, email }),
};
require.cache[servicePath] = {
  id: servicePath,
  filename: servicePath,
  loaded: true,
  exports: service,
};
const controller = require("./booking.controller");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("booking lookup and cancellation require booking ID plus checkout email", async () => {
  const invalid = response();
  await controller.lookupBooking({ body: { bookingId: 7, email: "" } }, invalid);
  assert.equal(invalid.statusCode, 400);

  const malformed = response();
  await controller.lookupBooking(
    { body: { bookingId: "BK-123", email: "buyer@example.test" } },
    malformed,
  );
  assert.equal(malformed.statusCode, 400);

  const lookedUp = response();
  await controller.lookupBooking(
    { body: { bookingId: "BK-ABCD-EFGH", email: "buyer@example.test" } },
    lookedUp,
  );
  assert.equal(lookedUp.body.data.id, "BK-ABCD-EFGH");
  assert.equal(lookedUp.body.data.email, "buyer@example.test");

  const cancelled = response();
  await controller.cancelBooking(
    { params: { bookingId: "BK-ABCD-EFGH" }, body: { email: "buyer@example.test" } },
    cancelled,
  );
  assert.equal(cancelled.statusCode, 200);
  assert.equal(cancelled.body.data.id, "BK-ABCD-EFGH");
});
