const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TEST_SECRET = /^[123]x0{31}AA$/;

function deny(res, status, code, message) {
  return res.status(status).json({ success: false, code, message });
}

function requireTurnstile(action, { fetchImpl = fetch, env = process.env } = {}) {
  return async function turnstile(req, res, next) {
    const secret = env.TURNSTILE_SECRET_KEY;
    const production = env.NODE_ENV === "production";
    if (!secret) {
      if (production) return deny(res, 503, "CAPTCHA_NOT_CONFIGURED", "Captcha is not configured");
      return next(); // local dev without keys
    }

    const token = req.body?.turnstileToken;
    if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
      return deny(res, 403, "CAPTCHA_REQUIRED", "Please complete the captcha");
    }

    let result;
    try {
      const response = await fetchImpl(SITEVERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, remoteip: req.ip ?? "" }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`siteverify ${response.status}`);
      result = await response.json();
    } catch (error) {
      console.error("Turnstile verification failed:", error.message);
      return deny(res, 403, "CAPTCHA_FAILED", "Captcha check failed, please try again");
    }

    if (!result?.success) return deny(res, 403, "CAPTCHA_FAILED", "Captcha check failed, please try again");

    // Dummy tokens carry no real action/hostname, so only check them with real keys.
    if (!TEST_SECRET.test(secret)) {
      const hostnames = (env.TURNSTILE_HOSTNAMES ?? "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean);
      if (production && hostnames.length === 0) {
        return deny(res, 503, "CAPTCHA_NOT_CONFIGURED", "Captcha is not configured");
      }
      if (result.action !== action || (hostnames.length > 0 && !hostnames.includes(result.hostname))) {
        return deny(res, 403, "CAPTCHA_FAILED", "Captcha check failed, please try again");
      }
    }
    return next();
  };
}

module.exports = { requireTurnstile };
