import mongoose from "mongoose";
import env from "./env.js";

mongoose.set("strictQuery", true);

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      dbName: "pms",
      autoIndex: !env.isProd,
    });

    console.log(
      `✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`
    );
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  await mongoose.connection.close();
  console.log("MongoDB Disconnected");
};