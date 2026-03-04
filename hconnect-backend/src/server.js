require("dotenv").config();
const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const axios = require("axios");
const { Pool } = require("pg");

const checkJwt = require("./middleware/auth");

// 初始化数据库连接
const db = new Pool({
  user: process.env.DB_USER || "hconnect_user",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "hconnect_db",
  password: process.env.DB_PASSWORD || "password",
  port: process.env.DB_PORT || 5432,
});

db.on("error", (err) => {
  console.error("Database pool error:", err);
});

const app = express();

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const envAllowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
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


// 初始化Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// in-memory map for sms codes
const smsVerificationCodes = new Map();
// in-memory map for verified phone tokens (short-lived) issued after successful /public/verify-sms
const verifiedPhoneTokens = new Map();

const SMS_CODE_LENGTH = Math.max(4, Math.min(8, Number(process.env.SMS_CODE_LENGTH || 6)));
const SMS_CODE_TTL_MS = Math.max(60 * 1000, Number(process.env.SMS_CODE_TTL_MS || 5 * 60 * 1000));

function generateNumericCode(length) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

// helper to send sms and store code
async function sendSmsHelper(phoneNumber, res) {
  try {
    const verificationCode = generateNumericCode(SMS_CODE_LENGTH);
    await twilioClient.messages.create({
      body: `Your verification code is: ${verificationCode}. Please do not share it with anyone.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
    smsVerificationCodes.set(phoneNumber, {
      code: verificationCode,
      expiresAt: Date.now() + SMS_CODE_TTL_MS,
    });
    res.json({ message: "Verification code sent successfully" });
  } catch (error) {
    console.error("SMS sending error:", error);
    res.status(500).json({ error: error.message });
  }
}

app.get("/api/test", checkJwt, (req, res) => {
  res.json({
    message: "token valid",
    user: req.auth.payload
  });
});

// Get current user's role from DB
app.get("/api/me/role", checkJwt, async (req, res) => {
  try {
    const sub = req.auth?.payload?.sub;
    if (!sub) return res.status(400).json({ error: "Invalid token payload" });

    // 1) primary lookup by auth0_id (sub)
    let result = await db.query(
      `SELECT "UserID", "role", "auth0_id", "email" FROM users WHERE "auth0_id"=$1 LIMIT 1`,
      [sub]
    );

    // 2) fallback lookup by email (for same person logging in via a different Auth0 identity connection)
    if (!result.rows.length) {
      const email = req.auth?.payload?.email || null;
      if (email) {
        const byEmail = await db.query(
          `SELECT "UserID", "role", "auth0_id", "email" FROM users WHERE "email"=$1 LIMIT 1`,
          [email]
        );

        if (byEmail.rows.length) {
          const row = byEmail.rows[0];

          // bind current sub to this existing email row when safe
          const conflict = await db.query(
            `SELECT 1 FROM users WHERE "auth0_id"=$1 LIMIT 1`,
            [sub]
          );

          if (!conflict.rows.length && row.auth0_id !== sub) {
            await db.query(
              `UPDATE users SET "auth0_id"=$1, "updated_at"=CURRENT_TIMESTAMP WHERE "UserID"=$2`,
              [sub, row.UserID]
            );
          }

          return res.json({ role: row.role });
        }
      }

      return res.json({ role: null, message: "Role not found" });
    }

    return res.json({ role: result.rows[0].role });
  } catch (error) {
    console.error("/api/me/role error:", error.message || error);
    return res.status(500).json({ error: "Failed to load role" });
  }
});

// 发送短信验证码 (authenticated)
app.post("/api/send-sms", checkJwt, async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }
  await sendSmsHelper(phoneNumber, res);
});

// 发送短信验证码 (public, no auth required)
app.post("/public/send-sms", async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }
  try {
    // check provider exists in pre-registered table but do NOT reveal details to client
    const prov = await db.query(`SELECT "ProviderID" FROM healthcare_providers WHERE phone_number=$1`, [phoneNumber]);
    if (!prov.rows.length) {
      // generic message to avoid leaking existence
      return res.status(400).json({ error: "Phone not eligible" });
    }
    await sendSmsHelper(phoneNumber, res);
  } catch (err) {
    console.error("/public/send-sms error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// 验证短信验证码 (authenticated)
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

  // authenticated version will still try update Auth0 metadata
  smsVerificationCodes.delete(phoneNumber);
  try {
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
    await axios.patch(
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
  } catch (error) {
    console.warn("Could not update Auth0 metadata directly. User will need to refresh page to see the updated status.");
    console.error("Error details:", error.response?.data || error.message);
  }
  res.json({ message: "Phone number verified successfully. Please refresh the page to see the updated status." });
});

// 验证短信验证码 (public, used during pre-registration)
app.post("/public/verify-sms", async (req, res) => {
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
  // consume SMS code
  smsVerificationCodes.delete(phoneNumber);

  // issue a short-lived verification token the frontend can present to the create-user endpoint
  const token = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 8);
  verifiedPhoneTokens.set(token, { phoneNumber, expiresAt: Date.now() + 15 * 60 * 1000 });

  res.json({ message: "Phone verification successful", verificationToken: token });
});


// Create Auth0 user via Management API after phone verification
app.post("/internal/create-auth0-user", async (req, res) => {
  try {
    const { email, password, name, phoneNumber, verificationToken } = req.body;
    if (!email || !name || !phoneNumber || !verificationToken) {
      return res.status(400).json({ error: "email, name, phoneNumber and verificationToken are required" });
    }

    // verify token
    const t = verifiedPhoneTokens.get(verificationToken);
    if (!t) return res.status(400).json({ error: "Invalid or expired verification token" });
    if (t.phoneNumber !== phoneNumber) return res.status(400).json({ error: "Verification token does not match phone number" });
    if (Date.now() > t.expiresAt) {
      verifiedPhoneTokens.delete(verificationToken);
      return res.status(400).json({ error: "Verification token expired" });
    }

    // ensure phone belongs to a pre-registered provider and not already used
    const provRes = await db.query(
      `SELECT "ProviderID" FROM healthcare_providers WHERE phone_number=$1`,
      [phoneNumber]
    );
    if (!provRes.rows.length) {
      return res.status(400).json({ error: "Phone not eligible" });
    }
    const providerId = provRes.rows[0].ProviderID;

    const registered = await db.query(`SELECT 1 FROM doctor_profiles WHERE "ProviderID"=$1`, [providerId]);
    if (registered.rows.length) {
      return res.status(409).json({ error: "Phone already registered" });
    }

    // Get Management API token (use M2M credentials if provided, fallback to AUTH0_CLIENT_ID/SECRET)
    const m2mClientId = process.env.AUTH0_M2M_CLIENT_ID || process.env.AUTH0_CLIENT_ID;
    const m2mClientSecret = process.env.AUTH0_M2M_CLIENT_SECRET || process.env.AUTH0_CLIENT_SECRET;
    if (!process.env.AUTH0_DOMAIN || !m2mClientId || !m2mClientSecret) {
      return res.status(500).json({ error: "Auth0 M2M credentials not configured on server" });
    }

    const tokenResponse = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        client_id: m2mClientId,
        client_secret: m2mClientSecret,
        audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
        grant_type: "client_credentials",
      }
    );
    const mgmtToken = tokenResponse.data.access_token;

    // create user in Auth0
    const connection = process.env.AUTH0_DB_CONNECTION || "Username-Password-Authentication";
    const createBody = {
      connection,
      email,
      name,
      email_verified: false,
      user_metadata: { phoneNumber },
      app_metadata: { providerId }
    };
    if (password) createBody.password = password;

    const createRes = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users`,
      createBody,
      {
        headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" }
      }
    );

    const created = createRes.data;

    // consume verification token only after Auth0 user has been created successfully
    verifiedPhoneTokens.delete(verificationToken);

    // write local user and doctor_profile if providerId provided
    try {
      const userResult = await db.query(
        `INSERT INTO users ("auth0_id", "email", "name", "role") VALUES ($1,$2,$3,$4) ON CONFLICT ("auth0_id") DO UPDATE SET "updated_at"=CURRENT_TIMESTAMP RETURNING "UserID"`,
        [created.user_id, email, name, 'doctor']
      );
      const userId = userResult.rows[0].UserID;
      await db.query(
        `INSERT INTO doctor_profiles ("UserID","ProviderID","registration_ip") VALUES ($1,$2,$3)`,
        [userId, providerId, req.ip]
      );
    } catch (dbErr) {
      console.warn("Could not write local user/profile after creating Auth0 user:", dbErr.message);
    }

    res.json({ success: true, auth0User: created });
  } catch (error) {
    console.error("/internal/create-auth0-user error:", error.response?.data || error.message || error);
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message };
    res.status(status).json(data);
  }
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

app.post("/api/doctor/verify-phone", async (req, res) => {
  const { country_code, phone } = req.body;
  if (!country_code || !phone) return res.status(400).json({ error: "Country code and phone number required" });
  
  // 只验证手机号是数字（不含特殊符号）
  if (!/^\d{7,15}$/.test(phone)) {
    return res.status(400).json({ error: "Invalid phone format (digits only, 7-15 chars)" });
  }
  
  // 从 country_code 提取国家代码，如 "+1-US" -> ["1", "US"]
  const codeMatch = country_code.match(/^\+([\d]+)(?:-(\w{2}))?$/);
  if (!codeMatch) {
    return res.status(400).json({ error: "Invalid country code format" });
  }
  
  const actualCode = "+" + codeMatch[1];
  const country = codeMatch[2] || null;
  const fullPhone = actualCode + phone;
  
  // 从预注册表查找可用的医生
  let query = `SELECT * FROM healthcare_providers WHERE phone_number=$1`;
  const params = [fullPhone];
  
  if (country) {
    query += ` AND country=$2`;
    params.push(country);
  }
  
  const provider = await db.query(query, params);
  if (!provider.rows.length) {
    return res.status(404).json({ error: "Phone number not found in provider database" });
  }
  
  // 检查电话是否已被注册（使用 ProviderID 作为外键）
  const providerId = provider.rows[0].ProviderID;
  const registered = await db.query(
    `SELECT 1 FROM doctor_profiles WHERE "ProviderID"=$1`, [providerId]
  );
  if (registered.rows.length) {
    return res.status(409).json({ error: "Phone number already registered" });
  }
  
  // 返回提供者信息（不含敏感数据）
  res.json({ 
    valid: true, 
    provider: {
      provider_name: provider.rows[0].provider_name,
      institution: provider.rows[0].institution,
      specialty: provider.rows[0].specialty,
      country: provider.rows[0].country
    }
  });
});

// POST /api/register - register user (after role selection)
app.post("/api/register", checkJwt, async (req, res) => {
  try {
    const { auth0_id, email, name, role, phone_number } = req.body;

    if (!["doctor", "patient"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    try {
      // 尝试写入数据库
      const userResult = await db.query(
        `INSERT INTO users ("auth0_id", "email", "name", "role") 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT("auth0_id") DO UPDATE SET "updated_at" = CURRENT_TIMESTAMP
         RETURNING "UserID"`,
        [auth0_id, email, name, role]
      );

      const userId = userResult.rows[0].UserID;

      // 创建相应的 profile
      if (role === "doctor") {
        // phone_number is already in full format (e.g., "+14168215694")
        // look up provider row and use ProviderID as FK into doctor_profiles
        const provRes = await db.query(
          `SELECT "ProviderID" FROM healthcare_providers WHERE phone_number=$1`, [phone_number]
        );
        if (!provRes.rows.length) {
          throw new Error("Phone number not found among pre-registered providers");
        }
        const providerId = provRes.rows[0].ProviderID;

        await db.query(
          `INSERT INTO doctor_profiles ("UserID", "ProviderID", "registration_ip")
            VALUES ($1,$2,$3)
            ON CONFLICT ("UserID") DO UPDATE 
              SET "ProviderID"=$2, "registration_ip"=$3`,
          [userId, providerId, req.ip]
        );
      }

      console.log(`✅ User registered in database: ${email} as ${role}`);
    } catch (dbError) {
      console.warn(`⚠️ Database unavailable, using fallback: ${dbError.message}`);
      // if database unavailable, still allow registration (frontend stores role in localStorage)
    }

    res.json({
      success: true,
      role,
      message: `${role === "doctor" ? "Doctor" : "Patient"} account setup complete`,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});