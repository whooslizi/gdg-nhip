const assert = require("node:assert/strict");
const test = require("node:test");
const { requireTurnstile } = require("./turnstile");

const REAL_SECRET = "0x4AAAAAAAreal-secret-for-tests";
const TEST_SECRET = "1x0000000000000000000000000000000AA";

function siteverify(result) {
  return async () => ({ ok: true, json: async () => result });
}

async function run({ env, fetchImpl = siteverify({ success: true }), body = { turnstileToken: "tok" }, action = "hold" }) {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;
  await requireTurnstile(action, { fetchImpl, env })({ body, ip: "1.2.3.4" }, res, () => {
    nextCalled = true;
  });
  return { nextCalled, status: res.statusCode, code: res.payload?.code };
}

const liveEnv = { TURNSTILE_SECRET_KEY: REAL_SECRET, TURNSTILE_HOSTNAMES: "gdg-nhip.vercel.app", NODE_ENV: "production" };
const goodResult = { success: true, action: "hold", hostname: "gdg-nhip.vercel.app" };

test("missing or oversized token is rejected before calling Cloudflare", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, json: async () => goodResult };
  };
  for (const body of [{}, { turnstileToken: "" }, { turnstileToken: 42 }, { turnstileToken: "x".repeat(2049) }, null]) {
    const r = await run({ env: liveEnv, fetchImpl, body });
    assert.deepEqual([r.nextCalled, r.status, r.code], [false, 403, "CAPTCHA_REQUIRED"]);
  }
  assert.equal(calls, 0);
});

test("a valid token with matching action and hostname passes, and sends secret, token and IP", async () => {
  let sent;
  const fetchImpl = async (_url, init) => {
    sent = init.body;
    return { ok: true, json: async () => goodResult };
  };
  const r = await run({ env: liveEnv, fetchImpl });
  assert.equal(r.nextCalled, true);
  assert.equal(sent.get("secret"), REAL_SECRET);
  assert.equal(sent.get("response"), "tok");
  assert.equal(sent.get("remoteip"), "1.2.3.4");
});

test("success:false is rejected", async () => {
  const r = await run({ env: liveEnv, fetchImpl: siteverify({ success: false }) });
  assert.deepEqual([r.nextCalled, r.status, r.code], [false, 403, "CAPTCHA_FAILED"]);
});

test("a token issued for another action is rejected with a real secret", async () => {
  const r = await run({ env: liveEnv, fetchImpl: siteverify({ ...goodResult, action: "lookup" }) });
  assert.deepEqual([r.nextCalled, r.status], [false, 403]);
});

test("a token issued on another hostname is rejected", async () => {
  const r = await run({ env: liveEnv, fetchImpl: siteverify({ ...goodResult, hostname: "evil.example" }) });
  assert.deepEqual([r.nextCalled, r.status], [false, 403]);
});

test("network errors, timeouts and non-200 responses fail closed", async () => {
  const failures = [
    async () => {
      throw new Error("network down");
    },
    async () => {
      throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    },
    async () => ({ ok: false, status: 500, json: async () => goodResult }),
  ];
  for (const fetchImpl of failures) {
    const r = await run({ env: liveEnv, fetchImpl });
    assert.deepEqual([r.nextCalled, r.status, r.code], [false, 403, "CAPTCHA_FAILED"]);
  }
});

test("no secret in production refuses with 503; no secret in dev skips the check", async () => {
  const prod = await run({ env: { NODE_ENV: "production" }, body: {} });
  assert.deepEqual([prod.nextCalled, prod.status, prod.code], [false, 503, "CAPTCHA_NOT_CONFIGURED"]);
  const dev = await run({ env: { NODE_ENV: "development" }, body: {} });
  assert.equal(dev.nextCalled, true);
});

test("a real secret in production without TURNSTILE_HOSTNAMES refuses with 503", async () => {
  const r = await run({ env: { TURNSTILE_SECRET_KEY: REAL_SECRET, NODE_ENV: "production" }, fetchImpl: siteverify(goodResult) });
  assert.deepEqual([r.nextCalled, r.status], [false, 503]);
});

test("a test secret skips the action and hostname checks", async () => {
  const r = await run({
    env: { TURNSTILE_SECRET_KEY: TEST_SECRET, TURNSTILE_HOSTNAMES: "gdg-nhip.vercel.app" },
    fetchImpl: siteverify({ success: true, action: "", hostname: "example.com" }),
  });
  assert.equal(r.nextCalled, true);
});
