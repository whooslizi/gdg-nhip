const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

// The real controllers and payment service run against this in-memory stand-in for Supabase.
let db;
function resetDb() {
  db = {
    bookings: [],
    payments: [],
    booking_seats: [],
    showtime_seats: [
      { showtimeid: 5, seatid: 1, status: "holding", holdtoken: "hold-1", bookingid: null },
      { showtimeid: 5, seatid: 2, status: "holding", holdtoken: "hold-1", bookingid: null },
    ],
    seats: [
      { seatid: 1, rowlabel: "A", seatnumber: 1, seattype: "standard", price: null },
      { seatid: 2, rowlabel: "A", seatnumber: 2, seattype: "standard", price: null },
    ],
    showtimes: [],
    events: [],
    rooms: [],
    cinemas: [],
  };
}

function from(table) {
  let rows = db[table];
  const query = {
    select: () => query,
    order: () => query,
    limit: () => query,
    eq(column, value) {
      rows = rows.filter((row) => row[column] === value);
      return query;
    },
    in(column, values) {
      rows = rows.filter((row) => values.includes(row[column]));
      return query;
    },
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    single: async () => ({ data: rows[0] ?? null, error: null }),
    then: (resolve) => resolve({ data: rows, error: null }),
  };
  return query;
}

const rpcs = {
  process_mock_payment(args) {
    const bookingid = db.bookings.length + 1;
    const bookingcode = `BK-TEST-000${bookingid}`;
    db.bookings.push({
      bookingid,
      bookingcode,
      username: args.p_user_name,
      userphone: args.p_user_phone,
      useremail: args.p_user_email.toLowerCase(),
      price: args.p_price,
      status: "confirmed",
      qrversion: 1,
      cancel_code_hash: args.p_cancel_code_hash,
    });
    for (const seat of db.showtime_seats.filter((s) => s.holdtoken === args.p_hold_token)) {
      Object.assign(seat, { status: "booked", holdtoken: null, bookingid });
      const detail = db.seats.find((s) => s.seatid === seat.seatid);
      db.booking_seats.push({ bookingid, showtimeid: seat.showtimeid, ...detail });
    }
    return { success: true, message: "Payment successful", data: { bookingId: bookingcode } };
  },
  cancel_booking(args) {
    const booking = db.bookings.find((b) => b.bookingid === args.p_booking_id);
    booking.status = "cancelled";
    for (const seat of db.showtime_seats.filter((s) => s.bookingid === booking.bookingid)) {
      Object.assign(seat, { status: "available", bookingid: null });
    }
    return { success: true };
  },
};

const supabasePath = path.resolve(__dirname, "../config/supabase.js");
require.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  exports: { from, rpc: async (name, args) => ({ data: rpcs[name](args), error: null }) },
};
const bookings = require("./booking.controller");
const { createMockPayment } = require("./payment.controller");

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

const EMAIL = "buyer@example.test";

async function pay() {
  const res = response();
  await createMockPayment(
    {
      body: {
        holdToken: "hold-1",
        userName: "An",
        userPhone: "0912345678",
        userEmail: EMAIL,
        price: 300000,
        result: "success",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  return res.body;
}

const cancel = async (bookingId, body) => {
  const res = response();
  await bookings.cancelBooking({ params: { bookingId }, body }, res);
  return res;
};

test.beforeEach(resetDb);

test("numeric and malformed booking IDs are rejected on GET, lookup and cancel", async () => {
  for (const bookingId of ["1", "42", 7, "BK-123", ""]) {
    const got = response();
    await bookings.getBooking({ params: { bookingId }, query: { email: EMAIL } }, got);
    assert.equal(got.statusCode, 400, `GET ${bookingId}`);

    const looked = response();
    await bookings.lookupBooking({ body: { bookingId, email: EMAIL } }, looked);
    assert.equal(looked.statusCode, 400, `lookup ${bookingId}`);

    assert.equal((await cancel(bookingId, { cancelCode: "ABCD-EFGH" })).statusCode, 400);
  }
});

test("payment returns the cancel code exactly once and stores only a hash", async () => {
  const body = await pay();
  const { cancelCode } = body.data;
  assert.match(cancelCode, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  assert.equal(JSON.stringify(body).split(cancelCode).length - 1, 1);

  const stored = db.bookings[0].cancel_code_hash;
  assert.equal(typeof stored, "string");
  assert.notEqual(stored, cancelCode);
  assert.ok(!stored.includes(cancelCode.replace("-", "")));
  assert.ok(!stored.includes(cancelCode));
});

test("GET and lookup never return the cancel code or its hash", async () => {
  const { cancelCode, bookingId } = (await pay()).data;

  const got = response();
  await bookings.getBooking({ params: { bookingId }, query: { email: EMAIL } }, got);
  const looked = response();
  await bookings.lookupBooking({ body: { bookingId, email: EMAIL } }, looked);

  for (const res of [got, looked]) {
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.id, bookingId);
    const json = JSON.stringify(res.body);
    assert.ok(!json.includes(cancelCode));
    assert.ok(!json.includes("cancelCode"));
    assert.ok(!json.includes("cancel_code_hash"));
    assert.ok(!json.includes(db.bookings[0].cancel_code_hash));
  }
});

test("cancel requires the code: missing 400, wrong 403, correct 200 and seats released", async () => {
  const { cancelCode, bookingId } = (await pay()).data;

  assert.equal((await cancel(bookingId, {})).statusCode, 400);
  assert.equal((await cancel(bookingId, { email: EMAIL })).statusCode, 400);

  const wrong = await cancel(bookingId, { cancelCode: "AAAA-AAAA" });
  assert.equal(wrong.statusCode, 403);
  assert.equal(wrong.body.code, "INVALID_CANCEL_CODE");
  assert.equal(db.bookings[0].status, "confirmed");

  const ok = await cancel(bookingId.toLowerCase(), { cancelCode: ` ${cancelCode.toLowerCase()} ` });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.data.status, "CANCELLED");
  assert.ok(!JSON.stringify(ok.body).includes("cancel_code_hash"));
  assert.ok(db.showtime_seats.every((seat) => seat.status === "available" && !seat.bookingid));
});

test("bookings made before cancel codes cannot be cancelled publicly", async () => {
  const { bookingId } = (await pay()).data;
  db.bookings[0].cancel_code_hash = null;

  const res = await cancel(bookingId, { cancelCode: "AAAA-AAAA" });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "CANCEL_NOT_AVAILABLE");
  assert.equal(db.bookings[0].status, "confirmed");
});

test("unknown booking codes return 404 on cancel", async () => {
  const res = await cancel("BK-ZZZZ-ZZZZ", { cancelCode: "AAAA-AAAA" });
  assert.equal(res.statusCode, 404);
});
