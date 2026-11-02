const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const servicePath = path.resolve(__dirname, "../services/payment.service.js");
const calls = [];
require.cache[servicePath] = {
  id: servicePath,
  filename: servicePath,
  loaded: true,
  exports: {
    processMockPayment: async (input) => {
      calls.push(input);
      return { success: true };
    },
  },
};
const { createMockPayment } = require("./payment.controller");

function response() {
  return {
    statusCode: 200,
    body: undefined,
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

const body = (userPhone) => ({
  holdToken: "hold",
  userName: "An",
  userPhone,
  userEmail: "an@example.com",
  price: 0,
  result: "success",
});

test("rejects phone numbers that are not Vietnamese numbers", async () => {
  for (const phone of ["abc", "12345", "0123", "01234567890", "+8412345678", "09x2345678"]) {
    const res = response();
    await createMockPayment({ body: body(phone) }, res);
    assert.equal(res.statusCode, 400, phone);
  }
  assert.equal(calls.length, 0);
});

test("accepts 0 or +84 numbers and strips spaces, dots and dashes", async () => {
  for (const [phone, saved] of [
    ["0912345678", "0912345678"],
    ["091 234 5678", "0912345678"],
    ["091.234-5678", "0912345678"],
    ["+84912345678", "+84912345678"],
  ]) {
    const res = response();
    await createMockPayment({ body: body(phone) }, res);
    assert.equal(res.statusCode, 200, phone);
    assert.equal(calls.at(-1).userPhone, saved);
  }
});
