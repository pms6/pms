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
import { purgeExpiredCaptures, closeAbandonedSessions } from "./controllers/screenMonitor.controller.js";

const app = express();

// How many proxy hops to trust when reading a client's address. This has to be
// set before the rate limiter, which keys on it — see the note in config/env.js.
app.set("trust proxy", env.trustProxy);

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
//
// The budget is per client address, so it only divides between users when
// `trust proxy` above is set correctly for the deployment. The ceiling allows
// for the app's polling floor: a staff member with a monitored shift running
// sends a presence heartbeat and a monitor poll every minute, and that is
// before they do any actual work.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000,
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

  // Staff screenshots past their organization's retention period are deleted
  // outright - from Cloudinary as well as from the record. Monitoring that is
  // proportionate today becomes a permanent file on someone if nothing ever
  // clears it, so this runs whether or not an admin remembers to press the
  // button.
  console.log("Purging expired staff monitoring screenshots...");
  const purged = await purgeExpiredCaptures();
  console.log(
    `Screenshots removed: ${purged.capturesRemoved}, Empty sessions removed: ${purged.sessionsRemoved}` +
      (purged.imagesFailed ? `, FAILED to delete from storage: ${purged.imagesFailed}` : "")
  );
});

// A monitored shift whose browser went away - a reload, a crash, a closed lid -
// has no way to tell us, so the server closes it once its next screenshot is an
// hour overdue.
//
// Hourly, not daily: the abandon threshold is an hour, and running the sweep
// once a morning left a laptop closed at 9am still reading as "running" on the
// admin board until 8am the next day.
cron.schedule("15 * * * *", async () => {
  const closed = await closeAbandonedSessions();
  if (closed.sessionsClosed) {
    console.log(`Abandoned monitoring sessions closed: ${closed.sessionsClosed}`);
  }
});

// Hourly digest of where the operation team members who have live location
// switched ON *and* are still sending positions are. Anyone whose device has
// gone quiet is left out, and organizations left with nobody online are
// skipped, so a quiet hour sends nothing.
cron.schedule("0 * * * *", async () => {
  const result = await sendAllLocationDigests();
  if (result.organizations) {
    console.log(
      `Location digests sent: ${result.sentCount}, Skipped: ${result.skipped}, Offline: ${result.offline}, Errors: ${result.errors.length}`
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