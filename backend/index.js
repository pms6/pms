import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

import env from "./config/env.js";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import { sendAllPendingReminders } from "./cranjob/complianceReminder.js";
import { sendAllContractReminders } from "./cranjob/contractReminder.js";
import { sendAllLocationDigests } from "./cranjob/locationDigest.js";

const app = express();

// Connect Database
await connectDB();

// Security Middleware
app.use(helmet());

app.use(
  cors({
    origin: env.corsOrigin === "*" ? true : env.corsOrigin,
    credentials: true,
  })
);

app.use(compression());

// Body Parser
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Cookie Parser
app.use(cookieParser());

// Rate Limiter
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Run every day at 8:00 AM
cron.schedule("0 8 * * *", async () => {
  console.log("Running compliance reminders...");
  const result = await sendAllPendingReminders();
  console.log(`Reminders sent: ${result.sentCount}, Errors: ${result.errors.length}`);

  console.log("Running contract expiry reminders...");
  const contracts = await sendAllContractReminders();
  console.log(
    `Contract reminders sent: ${contracts.sentCount}, Skipped: ${contracts.skipped}, Errors: ${contracts.errors.length}`
  );
});

// Hourly digest of where the agents who have live location switched ON are.
// Organizations with nobody sharing are skipped, so a quiet hour sends nothing.
cron.schedule("0 * * * *", async () => {
  const result = await sendAllLocationDigests();
  if (result.organizations) {
    console.log(
      `Location digests sent: ${result.sentCount}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`
    );
  }
});

// Routes
app.use(env.apiPrefix, routes);

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    environment: env.nodeEnv,
  });
});

// Start Server
app.listen(env.port, () => {
  console.log(
    `🚀 Server running on http://localhost:${env.port}`
  );
});