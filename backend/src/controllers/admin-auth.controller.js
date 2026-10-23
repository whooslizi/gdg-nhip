const { createAdminAuthService } = require("../services/admin-auth.service");

const adminAuth = createAdminAuthService();

function clientKey(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function login(req, res) {
  const result = adminAuth.login(
    req.body?.username,
    req.body?.password,
    clientKey(req),
  );

  if (!result.ok) {
    if (result.retryAfter) res.set("Retry-After", String(result.retryAfter));
    return res.status(result.status).json({
      success: false,
      code: result.status === 429 ? "LOGIN_LOCKED" : "LOGIN_FAILED",
      message: result.message,
      details: {
        ...(result.retryAfter && { retryAfter: result.retryAfter }),
        ...(result.attemptsRemaining !== undefined && {
          attemptsRemaining: result.attemptsRemaining,
        }),
      },
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      token: result.token,
      expiresAt: result.expiresAt,
      username: result.username,
    },
  });
}

function requireAdmin(req, res, next) {
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const session = adminAuth.verify(token);

  if (!session) {
    return res.status(401).json({
      success: false,
      code: "ADMIN_SESSION_INVALID",
      message: "Admin login is required",
    });
  }

  req.admin = session;
  return next();
}

function getSession(req, res) {
  return res.status(200).json({ success: true, data: req.admin });
}

module.exports = { login, requireAdmin, getSession };