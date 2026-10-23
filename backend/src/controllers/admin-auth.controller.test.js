const assert = require("node:assert/strict");
const test = require("node:test");

const previousConfig = {
  username: process.env.ADMIN_USERNAME,
  password: process.env.ADMIN_PASSWORD,
  secret: process.env.ADMIN_SESSION_SECRET,
};
process.env.ADMIN_USERNAME = "dashboard-admin";
process.env.ADMIN_PASSWORD = "correct-horse-battery";
process.env.ADMIN_SESSION_SECRET = "test-only-signing-secret-long-enough";

const controller = require("./admin-auth.controller");

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("admin login lockout and bearer middleware protect management routes", () => {
  const request = (username, password, ip = "192.0.2.1") => ({
    body: { username, password },
    ip,
    socket: { remoteAddress: ip },
    get: () => "",
  });

  assert.equal(controller.requireAdmin(request(), response(), () => {}).statusCode, 401);

  const first = response();
  controller.login(request("dashboard-admin", "bad"), first);
  assert.equal(first.statusCode, 401);
  assert.equal(first.body.details.attemptsRemaining, 2);

  const second = response();
  controller.login(request("dashboard-admin", "bad"), second);
  assert.equal(second.statusCode, 401);

  const locked = response();
  controller.login(request("dashboard-admin", "bad"), locked);
  assert.equal(locked.statusCode, 429);
  assert.equal(locked.headers["Retry-After"], "600");

  const authenticated = response();
  controller.login(request("dashboard-admin", "correct-horse-battery", "192.0.2.2"), authenticated);
  assert.equal(authenticated.statusCode, 200);
  const token = authenticated.body.data.token;
  let nextCalled = false;
  const authorized = response();
  controller.requireAdmin(
    { get: () => `Bearer ${token}` },
    authorized,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, true);

  const expiredOrInvalid = response();
  controller.requireAdmin({ get: () => "Bearer invalid" }, expiredOrInvalid, () => {});
  assert.equal(expiredOrInvalid.statusCode, 401);

  if (previousConfig.username === undefined) delete process.env.ADMIN_USERNAME;
  else process.env.ADMIN_USERNAME = previousConfig.username;
  if (previousConfig.password === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = previousConfig.password;
  if (previousConfig.secret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousConfig.secret;
});
