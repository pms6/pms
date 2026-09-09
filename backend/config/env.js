import dotenv from "dotenv";

dotenv.config();

const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;

  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: (process.env.NODE_ENV || "development") === "production",

  port: Number(process.env.PORT || 5000),

  apiPrefix: process.env.API_PREFIX || "/api/v1",

  corsOrigin: process.env.CORS_ORIGIN || "*",

  // How many reverse proxies sit in front of this app.
  //
  // Behind a load balancer (Render, Heroku, nginx) every request arrives from
  // the proxy's own address, so without this the rate limiter sees ONE client
  // and its per-IP budget becomes a single global budget shared by every user —
  // which the screen-monitor and presence polling exhaust first. 1 is right for
  // a single proxy; raise it only to the number of hops you actually run, since
  // trusting more than exist lets a client spoof its address through
  // X-Forwarded-For.
  trustProxy: Number(process.env.TRUST_PROXY ?? (process.env.NODE_ENV === "production" ? 1 : 0)),

  // ✅ Add this
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",

  mongoUri: required(
    "MONGO_URI",
    "mongodb://127.0.0.1:27017/pms"
  ),

  jwt: {
    accessSecret: required(
      "JWT_ACCESS_SECRET",
      "dev-access-secret"
    ),
    refreshSecret: required(
      "JWT_REFRESH_SECRET",
      "dev-refresh-secret"
    ),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "1d",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",
  },

  bcryptSaltRounds: Number(
    process.env.BCRYPT_SALT_ROUNDS || 12
  ),

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    // Unsigned preset used to copy remote CSV media into our account
    // (see utils/cloudinaryMirror.js). No API secret needed for this.
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "",
  },

  mail: {
    provider: process.env.MAIL_PROVIDER || "gmail",
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.MAIL_PORT || 587),
    user: process.env.MAIL_USER || "",
    password: process.env.MAIL_PASSWORD || "",
    from: process.env.MAIL_FROM || "PMS <no-reply@example.com>",
  },
};

export default env;