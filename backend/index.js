import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

import env from "./config/env.js";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import cookieParser from "cookie-parser";

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