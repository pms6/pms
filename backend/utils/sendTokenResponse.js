import jwt from "jsonwebtoken";
import env from "../config/env.js"; // Adjust path as needed

const sendTokenResponse = (user, statusCode, res) => {
  // Uses centralized config values
  const token = jwt.sign(
    { id: user._id },
    env.jwt.accessSecret,
    {
      expiresIn: env.jwt.accessExpires,
    }
  );

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: env.isProd, // Evaluates to true in production
    sameSite: "strict",
  };

  res
    .status(statusCode)
    .cookie("token", token, cookieOptions)
    .json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
};

export default sendTokenResponse;