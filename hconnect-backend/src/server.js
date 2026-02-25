require("dotenv").config();
const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const axios = require("axios");

const checkJwt = require("./middleware/auth");

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "DELETE", "PUT"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// 调试日志
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// 内存存储验证码（开发环境用）
const smsVerificationCodes = new Map();

// 初始化Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.get("/api/test", checkJwt, (req, res) => {
  res.json({
    message: "token valid",
    user: req.auth.payload
  });
});

// 发送短信验证码
app.post("/api/send-sms", checkJwt, async (req, res) => {
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 发送短信
    await twilioClient.messages.create({
      body: `Your verification code is: ${verificationCode}. Please do not share it with anyone.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    // 存储验证码（10分钟过期）
    smsVerificationCodes.set(phoneNumber, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    res.json({ 
      message: "Verification code sent successfully"
    });
  } catch (error) {
    console.error("SMS sending error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 验证短信验证码
app.post("/api/verify-sms", checkJwt, async (req, res) => {
  const { phoneNumber, code } = req.body;
  
  if (!phoneNumber || !code) {
    return res.status(400).json({ error: "Phone number and code are required" });
  }

  const stored = smsVerificationCodes.get(phoneNumber);
  
  if (!stored) {
    return res.status(400).json({ error: "No code found for this phone number. Please request a new one." });
  }

  if (Date.now() > stored.expiresAt) {
    smsVerificationCodes.delete(phoneNumber);
    return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
  }

  if (stored.code !== code) {
    return res.status(400).json({ error: "Incorrect verification code." });
  }

  // 验证成功，删除该验证码
  smsVerificationCodes.delete(phoneNumber);
  
  try {
    // 获取Management API Token更新用户信息
    const tokenResponse = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
        grant_type: "client_credentials"
      }
    );

    const accessToken = tokenResponse.data.access_token;
    const sub = req.auth.payload.sub;

    // 更新用户的user_metadata（存储验证信息）
    const updateResponse = await axios.patch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${sub}`,
      {
        user_metadata: {
          phone_number: phoneNumber,
          phone_verified: true,
          phone_verified_at: new Date().toISOString()
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("User metadata updated successfully:", updateResponse.data);
  } catch (error) {
    console.warn("Could not update Auth0 metadata directly. User will need to refresh page to see updated info.");
    console.error("Error details:", error.response?.data || error.message);
  }
  
  res.json({ message: "Phone number verified successfully. Please refresh the page to see the updated status." });
});

// 重新发送邮箱验证邮件
app.post("/api/send-verification-email", checkJwt, async (req, res) => {
  try {
    const sub = req.auth.payload.sub; // Auth0的user ID
    console.log("Sending verification email to:", sub);
    
    // 获取Management API Token
    const tokenResponse = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
        grant_type: "client_credentials"
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // 使用Management API发送验证邮件
    await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${sub}/send-email-verification`,
      { client_id: process.env.AUTH0_CLIENT_ID },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Verification email sent successfully");
    res.json({ message: "Verification email sent successfully" });
  } catch (error) {
    console.error("Email verification error:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});