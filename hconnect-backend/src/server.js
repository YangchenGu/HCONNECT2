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
const ALLOW_ALL_PHONES_FOR_TESTING = String(process.env.ALLOW_ALL_PHONES_FOR_TESTING || "false").toLowerCase() === "true";
const BYPASS_SMS_VERIFICATION_FOR_TESTING = String(process.env.BYPASS_SMS_VERIFICATION_FOR_TESTING || "false").toLowerCase() === "true";
const ENFORCE_REGION_MATCH_FOR_RELATION = String(process.env.ENFORCE_REGION_MATCH_FOR_RELATION || "false").toLowerCase() === "true";

function generateNumericCode(length) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

function issuePhoneVerificationToken(phoneNumber) {
  const token = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 8);
  verifiedPhoneTokens.set(token, { phoneNumber, expiresAt: Date.now() + 15 * 60 * 1000 });
  return token;
}

async function getManagementApiToken() {
  const m2mClientId = process.env.AUTH0_M2M_CLIENT_ID || process.env.AUTH0_CLIENT_ID;
  const m2mClientSecret = process.env.AUTH0_M2M_CLIENT_SECRET || process.env.AUTH0_CLIENT_SECRET;
  if (!process.env.AUTH0_DOMAIN || !m2mClientId || !m2mClientSecret) {
    throw new Error("Auth0 M2M credentials not configured on server");
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

  return tokenResponse.data.access_token;
}

function getReadableAuth0Error(error, fallback = "Request failed") {
  const data = error?.response?.data;
  if (!data) return fallback;

  const detailText = Array.isArray(data.details)
    ? data.details
        .map((d) => d?.message || d?.error || "")
        .filter(Boolean)
        .join("; ")
    : "";

  const base = data.message || data.description || data.error_description || data.error || fallback;
  return detailText ? `${base} (${detailText})` : base;
}

async function initDbArtifacts() {
  // Stores doctor -> patient match requests before a formal relationship is created.
  await db.query(`
    CREATE TABLE IF NOT EXISTS doctor_patient_match_requests (
      "RequestID" SERIAL PRIMARY KEY,
      "DoctorID" INT NOT NULL REFERENCES doctor_profiles("DoctorID") ON DELETE CASCADE,
      "PatientID" INT NOT NULL REFERENCES patient_profiles("PatientID") ON DELETE CASCADE,
      "status" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'accepted', 'rejected', 'cancelled')),
      "message" TEXT,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "responded_at" TIMESTAMP
    )
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_match_request
    ON doctor_patient_match_requests ("DoctorID", "PatientID")
    WHERE "status" = 'pending'
  `);

  // Appointment slots and requests used by patient booking + doctor notifications.
  await db.query(`
    CREATE TABLE IF NOT EXISTS appointment_slots (
      "SlotID" SERIAL PRIMARY KEY,
      "DoctorID" INT NOT NULL REFERENCES doctor_profiles("DoctorID") ON DELETE CASCADE,
      "start_time" TIMESTAMP NOT NULL,
      "end_time" TIMESTAMP NOT NULL,
      "is_booked" BOOLEAN DEFAULT FALSE,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Store slot availability outside appointment_slots to avoid requiring table ownership for ALTER TABLE.
  await db.query(`
    CREATE TABLE IF NOT EXISTS appointment_slot_availability (
      "SlotID" INT PRIMARY KEY REFERENCES appointment_slots("SlotID") ON DELETE CASCADE,
      "is_available" BOOLEAN NOT NULL DEFAULT TRUE,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      "AppointmentID" SERIAL PRIMARY KEY,
      "DoctorID" INT NOT NULL REFERENCES doctor_profiles("DoctorID") ON DELETE CASCADE,
      "PatientID" INT NOT NULL REFERENCES patient_profiles("PatientID") ON DELETE CASCADE,
      "SlotID" INT NOT NULL REFERENCES appointment_slots("SlotID") ON DELETE CASCADE,
      "status" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'confirmed', 'cancelled', 'completed')),
      "reason" TEXT,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Patient health reporting artifacts.
  await db.query(`
    CREATE TABLE IF NOT EXISTS health_metric_types (
      "MetricTypeID" SERIAL PRIMARY KEY,
      "name" VARCHAR(100) NOT NULL,
      "unit" VARCHAR(50),
      "min_value" DECIMAL(10,2),
      "max_value" DECIMAL(10,2),
      "description" TEXT
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS patient_metric_records (
      "RecordID" SERIAL PRIMARY KEY,
      "PatientID" INT NOT NULL REFERENCES patient_profiles("PatientID") ON DELETE CASCADE,
      "MetricTypeID" INT NOT NULL REFERENCES health_metric_types("MetricTypeID") ON DELETE CASCADE,
      "value" DECIMAL(10,2) NOT NULL,
      "recorded_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "source" VARCHAR(20) DEFAULT 'manual',
      "notes" TEXT
    )
  `);

  // Doctor written advice for linked patients.
  await db.query(`
    CREATE TABLE IF NOT EXISTS patient_advices (
      "AdviceID" SERIAL PRIMARY KEY,
      "DoctorID" INT NOT NULL REFERENCES doctor_profiles("DoctorID") ON DELETE CASCADE,
      "PatientID" INT NOT NULL REFERENCES patient_profiles("PatientID") ON DELETE CASCADE,
      "content" TEXT NOT NULL,
      "urgency" VARCHAR(20) NOT NULL CHECK ("urgency" IN ('urgent', 'normal', 'low')),
      "is_acknowledged" BOOLEAN NOT NULL DEFAULT FALSE,
      "acknowledged_at" TIMESTAMP,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Audit trail for data mutations and sensitive operations.
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      "AuditID" SERIAL PRIMARY KEY,
      "event_type" VARCHAR(120) NOT NULL,
      "action" VARCHAR(20) NOT NULL CHECK ("action" IN ('create', 'update', 'delete', 'upsert', 'other')),
      "status" VARCHAR(20) NOT NULL DEFAULT 'success' CHECK ("status" IN ('success', 'failed', 'denied')),
      "actor_user_id" INT,
      "actor_role" VARCHAR(20),
      "target_type" VARCHAR(80),
      "target_id" VARCHAR(120),
      "request_method" VARCHAR(10),
      "request_path" TEXT,
      "ip" VARCHAR(80),
      "user_agent" TEXT,
      "details" JSONB,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_patient_advices_patient_created
    ON patient_advices ("PatientID", "created_at" DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_patient_advices_pending
    ON patient_advices ("PatientID", "is_acknowledged", "created_at" DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs ("created_at" DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
    ON audit_logs ("actor_user_id", "created_at" DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_event_created
    ON audit_logs ("event_type", "created_at" DESC)
  `);

  // Match request read paths (doctor + patient notifications/list pages).
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_match_requests_doctor_status_created
    ON doctor_patient_match_requests ("DoctorID", "status", "created_at" DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_match_requests_patient_status_created
    ON doctor_patient_match_requests ("PatientID", "status", "created_at" DESC)
  `);

  // Appointment read paths (notifications, dashboard, appointments list).
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_appointments_doctor_status_created
    ON appointments ("DoctorID", "status", "created_at" DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_appointments_patient_created
    ON appointments ("PatientID", "created_at" DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_appointments_slot_status
    ON appointments ("SlotID", "status")
  `);

  // Slot lookup paths.
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_appointment_slots_doctor_start_time
    ON appointment_slots ("DoctorID", "start_time")
  `);

  // Relation list/count paths.
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_relations_doctor_status_created
    ON doctor_patient_relations ("DoctorID", "status", "created_at" DESC)
  `);

  // Advice lookup paths from doctor dashboard/details.
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_patient_advices_doctor_created
    ON patient_advices ("DoctorID", "created_at" DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_patient_advices_doctor_ack_created
    ON patient_advices ("DoctorID", "is_acknowledged", "created_at" DESC)
  `);

  // Metrics reporting/history paths.
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_patient_metric_records_patient_recorded
    ON patient_metric_records ("PatientID", "recorded_at" DESC)
  `);

  // Enforce one active appointment per slot when data is clean.
  // If historical duplicates exist, this block skips index creation instead of failing startup.
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'uniq_active_appointment_per_slot'
      ) THEN
        IF NOT EXISTS (
          SELECT 1
          FROM appointments
          GROUP BY "SlotID"
          HAVING COUNT(*) FILTER (WHERE "status" IN ('pending', 'confirmed')) > 1
        ) THEN
          EXECUTE 'CREATE UNIQUE INDEX uniq_active_appointment_per_slot ON appointments ("SlotID") WHERE "status" IN (''pending'', ''confirmed'')';
        END IF;
      END IF;
    END
    $$;
  `);
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLocalDayBounds(value = new Date()) {
  const d = new Date(value);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function getUserBySub(sub) {
  const userRes = await db.query(
    `SELECT "UserID", "role", "email", "name", "auth0_id" FROM users WHERE "auth0_id"=$1 LIMIT 1`,
    [sub]
  );
  return userRes.rows[0] || null;
}

async function ensurePatientProfileByUserId(userId) {
  await db.query(`INSERT INTO patient_profiles ("UserID") VALUES ($1) ON CONFLICT ("UserID") DO NOTHING`, [userId]);
  const p = await db.query(`SELECT "PatientID" FROM patient_profiles WHERE "UserID"=$1 LIMIT 1`, [userId]);
  return p.rows[0] || null;
}

async function getDoctorProfileByUserId(userId) {
  const d = await db.query(`SELECT "DoctorID", "ProviderID" FROM doctor_profiles WHERE "UserID"=$1 LIMIT 1`, [userId]);
  return d.rows[0] || null;
}

async function ensureDoctorProfileByUser(user, registrationIp = null) {
  const existing = await getDoctorProfileByUserId(user.UserID);
  if (existing) return existing;

  const providerName = String(user.name || user.email || `Doctor ${user.UserID}`).slice(0, 255);
  const syntheticPhone = `doc-${user.UserID}`;

  const provider = await db.query(
    `INSERT INTO healthcare_providers ("country", "phone_number", "provider_name", "institution", "specialty")
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT ("country", "phone_number") DO UPDATE SET
       "provider_name"=EXCLUDED."provider_name"
     RETURNING "ProviderID"`,
    ["ZZ", syntheticPhone, providerName, "Unverified", "General"]
  );

  const providerId = provider.rows[0]?.ProviderID;
  if (!providerId) {
    throw new Error("Failed to provision provider for doctor profile");
  }

  await db.query(
    `INSERT INTO doctor_profiles ("UserID", "ProviderID", "registration_ip")
     VALUES ($1,$2,$3)
     ON CONFLICT ("UserID") DO NOTHING`,
    [user.UserID, providerId, registrationIp]
  );

  return await getDoctorProfileByUserId(user.UserID);
}

async function ensureDefaultSlotsForDoctor(doctorId) {
  const now = new Date();
  const minutes = [0, 30];
  const slotHours = [9, 10, 14, 15];

  for (let offset = 1; offset <= 8; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);

    for (const hour of slotHours) {
      for (const minute of minutes) {
        const start = new Date(day);
        start.setHours(hour, minute, 0, 0);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 30);

        await db.query(
          `INSERT INTO appointment_slots ("DoctorID", "start_time", "end_time", "is_booked")
           SELECT $1,$2,$3,FALSE
           WHERE NOT EXISTS (
             SELECT 1 FROM appointment_slots
             WHERE "DoctorID"=$1 AND "start_time"=$2
           )`,
          [doctorId, start.toISOString(), end.toISOString()]
        );
      }
    }
  }

  // Ensure every slot has an availability row (default TRUE).
  await db.query(
    `INSERT INTO appointment_slot_availability ("SlotID", "is_available")
     SELECT s."SlotID", TRUE
     FROM appointment_slots s
     LEFT JOIN appointment_slot_availability a ON a."SlotID"=s."SlotID"
     WHERE s."DoctorID"=$1 AND a."SlotID" IS NULL`,
    [doctorId]
  );
}

function normalizeDateOnlyString(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function formatLocalDateOnly(value) {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildEditableDateWindow() {
  const now = new Date();
  const values = [];
  for (let i = 1; i <= 8; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    values.push(formatLocalDateOnly(d));
  }
  return values;
}

function parseCountrySelection(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;
  const matched = raw.match(/^\+([\d]+)(?:-(\w{2}))?$/);
  if (!matched) return null;
  const dialCode = `+${matched[1]}`;
  const country = matched[2] ? String(matched[2]).toUpperCase() : null;
  return { dialCode, country };
}

function normalizeOptionalPhoneDigits(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (!/^\d{7,15}$/.test(digits)) {
    throw new Error("Phone must contain 7-15 digits");
  }
  return digits;
}

async function getDoctorCountryByDoctorId(doctorId, executor = db) {
  const result = await executor.query(
    `SELECT COALESCE(u."country", hp."country") AS country
     FROM doctor_profiles dp
     JOIN users u ON u."UserID"=dp."UserID"
     LEFT JOIN healthcare_providers hp ON hp."ProviderID"=dp."ProviderID"
     WHERE dp."DoctorID"=$1
     LIMIT 1`,
    [doctorId]
  );
  return result.rows[0]?.country || null;
}

async function getPatientCountryByPatientId(patientId, executor = db) {
  const result = await executor.query(
    `SELECT u."country" AS country
     FROM patient_profiles pp
     JOIN users u ON u."UserID"=pp."UserID"
     WHERE pp."PatientID"=$1
     LIMIT 1`,
    [patientId]
  );
  return result.rows[0]?.country || null;
}

function normalizeAdviceUrgency(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["urgent", "紧急"].includes(raw)) return "urgent";
  if (["normal", "一般"].includes(raw)) return "normal";
  if (["low", "not urgent", "non-urgent", "不紧急"].includes(raw)) return "low";
  return null;
}

function requireRole(role) {
  return async (req, res, next) => {
    try {
      const sub = req.auth?.payload?.sub;
      if (!sub) return res.status(400).json({ error: "Invalid token payload" });

      const currentUser = await getUserBySub(sub);
      if (!currentUser) return res.status(404).json({ error: "User not found" });
      if (currentUser.role !== role) return res.status(403).json({ error: `Requires ${role} role` });

      req.currentUser = currentUser;
      next();
    } catch (error) {
      console.error("requireRole error:", error.message || error);
      res.status(500).json({ error: "Role check failed" });
    }
  };
}

function toAuditSafeJson(value) {
  try {
    return value === undefined ? null : JSON.parse(JSON.stringify(value));
  } catch {
    return { note: "unserializable_details" };
  }
}

async function resolveAuditActor(req) {
  if (req.currentUser) {
    return {
      userId: req.currentUser.UserID || null,
      role: req.currentUser.role || null,
    };
  }

  if (req._cachedAuditActor) return req._cachedAuditActor;

  const sub = req.auth?.payload?.sub;
  if (!sub) {
    const anonymous = { userId: null, role: null };
    req._cachedAuditActor = anonymous;
    return anonymous;
  }

  const row = await getUserBySub(sub).catch(() => null);
  const resolved = {
    userId: row?.UserID || null,
    role: row?.role || null,
  };
  req._cachedAuditActor = resolved;
  return resolved;
}

async function writeAuditEvent({
  client,
  req,
  eventType,
  action,
  status = "success",
  targetType = null,
  targetId = null,
  actorUserId = null,
  actorRole = null,
  details = null,
}) {
  try {
    const actor = await resolveAuditActor(req || {});
    const resolvedActorUserId = actorUserId ?? actor.userId ?? null;
    const resolvedActorRole = actorRole ?? actor.role ?? null;
    const executor = client || db;

    await executor.query(
      `INSERT INTO audit_logs (
          "event_type", "action", "status", "actor_user_id", "actor_role", "target_type", "target_id",
          "request_method", "request_path", "ip", "user_agent", "details"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
        String(eventType || "unknown_event").slice(0, 120),
        ["create", "update", "delete", "upsert", "other"].includes(action) ? action : "other",
        ["success", "failed", "denied"].includes(status) ? status : "failed",
        resolvedActorUserId,
        resolvedActorRole ? String(resolvedActorRole).slice(0, 20) : null,
        targetType ? String(targetType).slice(0, 80) : null,
        targetId === null || targetId === undefined ? null : String(targetId).slice(0, 120),
        req?.method || null,
        req?.path || req?.originalUrl || null,
        req?.ip || null,
        req?.headers?.["user-agent"] || null,
        JSON.stringify(toAuditSafeJson(details)),
      ]
    );
  } catch (error) {
    console.warn("audit log write failed:", error.message || error);
  }
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
    if (!ALLOW_ALL_PHONES_FOR_TESTING) {
      // check provider exists in pre-registered table but do NOT reveal details to client
      const prov = await db.query(`SELECT "ProviderID" FROM healthcare_providers WHERE phone_number=$1`, [phoneNumber]);
      if (!prov.rows.length) {
        // generic message to avoid leaking existence
        return res.status(400).json({ error: "Phone not eligible" });
      }
    }

    if (BYPASS_SMS_VERIFICATION_FOR_TESTING) {
      const verificationToken = issuePhoneVerificationToken(phoneNumber);
      return res.json({
        message: "SMS verification bypassed in testing mode",
        verificationToken,
        bypassVerification: true,
      });
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
  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  if (BYPASS_SMS_VERIFICATION_FOR_TESTING) {
    if (!ALLOW_ALL_PHONES_FOR_TESTING) {
      const prov = await db.query(`SELECT "ProviderID" FROM healthcare_providers WHERE phone_number=$1`, [phoneNumber]);
      if (!prov.rows.length) {
        return res.status(400).json({ error: "Phone not eligible" });
      }
    }

    const verificationToken = issuePhoneVerificationToken(phoneNumber);
    return res.json({
      message: "Phone verification bypassed in testing mode",
      verificationToken,
      bypassVerification: true,
    });
  }

  if (!code) {
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
  const token = issuePhoneVerificationToken(phoneNumber);

  res.json({ message: "Phone verification successful", verificationToken: token });
});


// Create Auth0 user via Management API after phone verification
app.post("/internal/create-auth0-user", async (req, res) => {
  try {
    const { email, password, name, phoneNumber, verificationToken, countryCode } = req.body;
    if (!email || !name || !phoneNumber || !verificationToken) {
      return res.status(400).json({ error: "email, name, phoneNumber and verificationToken are required" });
    }

    const parsedCountrySelection = parseCountrySelection(countryCode);
    if (!parsedCountrySelection || !parsedCountrySelection.country) {
      return res.status(400).json({ error: "countryCode is required. Use values like +1-US or +1-CA" });
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
    // In testing mode, create a temporary provider record when not found.
    let providerId;
    let providerCountry = null;
    let providerPhone = phoneNumber;
    const provRes = await db.query(
      `SELECT "ProviderID", "country", "phone_number"
       FROM healthcare_providers
       WHERE phone_number=$1 AND "country"=$2
       LIMIT 1`,
      [phoneNumber, parsedCountrySelection.country]
    );
    if (!provRes.rows.length) {
      if (!ALLOW_ALL_PHONES_FOR_TESTING) {
        return res.status(400).json({ error: "Phone not eligible" });
      }

      const inserted = await db.query(
        `INSERT INTO healthcare_providers (country, phone_number, provider_name, institution, specialty)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING "ProviderID", "country", "phone_number"`,
        [parsedCountrySelection.country, phoneNumber, "Test Provider", "HCONNECT Test", "General"]
      );
      providerId = inserted.rows[0].ProviderID;
      providerCountry = inserted.rows[0].country || null;
      providerPhone = inserted.rows[0].phone_number || phoneNumber;
    } else {
      providerId = provRes.rows[0].ProviderID;
      providerCountry = provRes.rows[0].country || null;
      providerPhone = provRes.rows[0].phone_number || phoneNumber;
    }

    const registered = await db.query(`SELECT 1 FROM doctor_profiles WHERE "ProviderID"=$1`, [providerId]);
    if (registered.rows.length) {
      return res.status(409).json({ error: "Phone already registered" });
    }

    const mgmtToken = await getManagementApiToken();

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
        `INSERT INTO users ("auth0_id", "email", "name", "role", "phone", "country")
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT ("auth0_id") DO UPDATE SET
           "email"=EXCLUDED."email",
           "name"=EXCLUDED."name",
           "role"=EXCLUDED."role",
           "phone"=COALESCE(EXCLUDED."phone", users."phone"),
           "country"=COALESCE(EXCLUDED."country", users."country"),
           "updated_at"=CURRENT_TIMESTAMP
         RETURNING "UserID"`,
        [created.user_id, email, name, 'doctor', providerPhone, providerCountry]
      );
      const userId = userResult.rows[0].UserID;
      await db.query(
        `INSERT INTO doctor_profiles ("UserID","ProviderID","registration_ip") VALUES ($1,$2,$3)`,
        [userId, providerId, req.ip]
      );
    } catch (dbErr) {
      console.warn("Could not write local user/profile after creating Auth0 user:", dbErr.message);
    }

    await writeAuditEvent({
      req,
      eventType: "auth.doctor_account_created_internal",
      action: "create",
      status: "success",
      targetType: "auth0_user",
      targetId: created.user_id,
      details: {
        email,
        providerId,
      },
    });

    res.json({ success: true, auth0User: created });
  } catch (error) {
    console.error("/internal/create-auth0-user error:", error.response?.data || error.message || error);
    await writeAuditEvent({
      req,
      eventType: "auth.doctor_account_created_internal",
      action: "create",
      status: "failed",
      targetType: "auth0_user",
      details: {
        error: getReadableAuth0Error(error, error.message || "Failed to create account"),
      },
    });
    const status = error.response?.status || 500;
    const message = getReadableAuth0Error(error, error.message || "Failed to create account");
    res.status(status).json({ error: message });
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

app.get("/api/account/security", checkJwt, async (req, res) => {
  const sub = req.auth?.payload?.sub;
  if (!sub) return res.status(400).json({ error: "Invalid token payload" });

  let name = req.auth?.payload?.name || null;
  let email = req.auth?.payload?.email || null;
  let phone = null;
  let country = null;
  let lastLogin = null;
  let lastPasswordChange = null;

  try {
    const localUser = await db.query(
      `SELECT "name", "email", "phone", "country" FROM users WHERE "auth0_id"=$1 LIMIT 1`,
      [sub]
    );
    if (localUser.rows.length) {
      const row = localUser.rows[0];
      if (row.name) name = row.name;
      if (row.email) email = row.email;
      if (row.phone) phone = row.phone;
      if (row.country) country = row.country;
    }
  } catch (error) {
    console.warn("/api/account/security local email lookup warning:", error.message || error);
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const encodedSub = encodeURIComponent(sub);
    const profileRes = await axios.get(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodedSub}`,
      { headers: { Authorization: `Bearer ${mgmtToken}` } }
    );

    lastLogin = profileRes.data?.last_login || null;
    lastPasswordChange = profileRes.data?.last_password_reset || null;
    if (!name && profileRes.data?.name) {
      name = profileRes.data.name;
    }
    if (!email && profileRes.data?.email) {
      email = profileRes.data.email;
    }
    if (!phone && profileRes.data?.user_metadata?.phoneNumber) {
      phone = profileRes.data.user_metadata.phoneNumber;
    }
    if (!country && profileRes.data?.user_metadata?.country) {
      country = String(profileRes.data.user_metadata.country).toUpperCase();
    }
  } catch (error) {
    console.warn("/api/account/security Auth0 profile warning:", error.response?.data || error.message || error);
  }

  return res.json({
    name,
    email,
    phone,
    country,
    lastLogin,
    lastPasswordChange,
  });
});

app.post("/api/account/password-reset-email", checkJwt, async (req, res) => {
  const sub = req.auth?.payload?.sub;
  if (!sub) return res.status(400).json({ error: "Invalid token payload" });

  let email = req.auth?.payload?.email || null;
  const connection = process.env.AUTH0_DB_CONNECTION || "Username-Password-Authentication";

  if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_CLIENT_ID) {
    return res.status(500).json({ error: "Auth0 configuration missing on server" });
  }

  try {
    if (!email) {
      const localUser = await db.query(
        `SELECT "email" FROM users WHERE "auth0_id"=$1 LIMIT 1`,
        [sub]
      );
      if (localUser.rows.length && localUser.rows[0].email) {
        email = localUser.rows[0].email;
      }
    }

    if (!email) {
      return res.status(400).json({ error: "Could not resolve account email" });
    }

    await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/dbconnections/change_password`,
      {
        client_id: process.env.AUTH0_CLIENT_ID,
        email,
        connection,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return res.json({ success: true, message: "Password reset email sent" });
  } catch (error) {
    console.error("/api/account/password-reset-email error:", error.response?.data || error.message || error);
    const status = error.response?.status || 500;
    const message = getReadableAuth0Error(error, "Failed to send password reset email");
    return res.status(status).json({ error: message });
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
    const { auth0_id, email, name, role, phone_number, country_code } = req.body;

    if (!["doctor", "patient"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    try {
      let resolvedPhone = String(phone_number || "").trim() || null;
      let resolvedCountry = null;
      const parsedCountrySelection = parseCountrySelection(country_code);
      if (country_code && !parsedCountrySelection) {
        throw new Error("Invalid country_code format. Use values like +1-US or +1-CA");
      }

      if (role === "doctor") {
        if (!resolvedPhone) {
          throw new Error("Doctor registration requires phone_number");
        }

        let provRes;
        if (parsedCountrySelection?.country) {
          provRes = await db.query(
            `SELECT "ProviderID", "country", "phone_number" FROM healthcare_providers WHERE phone_number=$1 AND "country"=$2 LIMIT 1`,
            [resolvedPhone, parsedCountrySelection.country]
          );
        } else {
          provRes = await db.query(
            `SELECT "ProviderID", "country", "phone_number" FROM healthcare_providers WHERE phone_number=$1 LIMIT 1`,
            [resolvedPhone]
          );
        }
        if (!provRes.rows.length) {
          throw new Error("Phone number not found among pre-registered providers");
        }

        resolvedPhone = provRes.rows[0].phone_number || resolvedPhone;
        resolvedCountry = provRes.rows[0].country || null;
      } else if (role === "patient") {
        if (resolvedPhone && !/^\+\d{7,20}$/.test(resolvedPhone)) {
          throw new Error("Patient phone_number must be in full international format (e.g. +14165551234)");
        }
        resolvedCountry = parsedCountrySelection?.country || null;
      }

      // 尝试写入数据库
      const userResult = await db.query(
        `INSERT INTO users ("auth0_id", "email", "name", "role", "phone", "country") 
         VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT("auth0_id") DO UPDATE SET
           "email"=EXCLUDED."email",
           "name"=EXCLUDED."name",
           "role"=EXCLUDED."role",
           "phone"=COALESCE(EXCLUDED."phone", users."phone"),
           "country"=COALESCE(EXCLUDED."country", users."country"),
           "updated_at" = CURRENT_TIMESTAMP
         RETURNING "UserID"`,
        [auth0_id, email, name, role, resolvedPhone, resolvedCountry]
      );

      const userId = userResult.rows[0].UserID;

      // 创建相应的 profile
      if (role === "doctor") {
        // look up provider row and use ProviderID as FK into doctor_profiles
        const provRes = await db.query(
          `SELECT "ProviderID" FROM healthcare_providers WHERE phone_number=$1 LIMIT 1`, [resolvedPhone]
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
      } else if (role === "patient") {
        await ensurePatientProfileByUserId(userId);
      }

      await writeAuditEvent({
        req,
        eventType: "user.role_registered",
        action: "upsert",
        status: "success",
        targetType: "user",
        targetId: userId,
        details: {
          auth0_id,
          email,
          role,
        },
      });

      console.log(`✅ User registered in database: ${email} as ${role}`);
    } catch (dbError) {
      console.warn(`⚠️ Database unavailable, using fallback: ${dbError.message}`);
      await writeAuditEvent({
        req,
        eventType: "user.role_registered",
        action: "upsert",
        status: "failed",
        targetType: "user",
        details: {
          auth0_id,
          email,
          role,
          error: dbError.message || String(dbError),
        },
      });
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

// Public patient registration (no phone verification required)
app.post("/public/register-patient", async (req, res) => {
  try {
    const { email, password, name, countryCode, phone } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password and name are required" });
    }

    const parsedCountrySelection = parseCountrySelection(countryCode);
    if (!parsedCountrySelection || !parsedCountrySelection.country) {
      return res.status(400).json({ error: "countryCode is required (e.g., +1-US, +1-CA)" });
    }

    let fullPhone = null;
    try {
      const digits = normalizeOptionalPhoneDigits(phone);
      fullPhone = digits ? `${parsedCountrySelection.dialCode}${digits}` : null;
    } catch (error) {
      return res.status(400).json({ error: error.message || "Invalid phone" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const mgmtToken = await getManagementApiToken();
    const connection = process.env.AUTH0_DB_CONNECTION || "Username-Password-Authentication";

    const createRes = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users`,
      {
        connection,
        email,
        password,
        name,
        email_verified: false,
        user_metadata: {
          country: parsedCountrySelection.country,
          ...(fullPhone ? { phoneNumber: fullPhone } : {}),
        },
      },
      {
        headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" }
      }
    );

    const created = createRes.data;

    try {
      const userWrite = await db.query(
        `INSERT INTO users ("auth0_id", "email", "name", "role", "phone", "country")
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT ("auth0_id") DO UPDATE SET
           "email"=EXCLUDED."email",
           "name"=EXCLUDED."name",
           "role"=EXCLUDED."role",
           "phone"=COALESCE(EXCLUDED."phone", users."phone"),
           "country"=COALESCE(EXCLUDED."country", users."country"),
           "updated_at"=CURRENT_TIMESTAMP
         RETURNING "UserID"`,
        [created.user_id, email, name, "patient", fullPhone, parsedCountrySelection.country]
      );

      const userId = userWrite.rows[0]?.UserID;
      if (userId) {
        await ensurePatientProfileByUserId(userId);

        await writeAuditEvent({
          req,
          eventType: "auth.patient_registered_public",
          action: "create",
          status: "success",
          targetType: "user",
          targetId: userId,
          details: {
            email,
            auth0UserId: created.user_id,
          },
        });
      }
    } catch (dbErr) {
      console.warn("Could not write local patient row after Auth0 creation:", dbErr.message);
      await writeAuditEvent({
        req,
        eventType: "auth.patient_registered_public",
        action: "create",
        status: "failed",
        targetType: "auth0_user",
        targetId: created.user_id,
        details: {
          email,
          error: dbErr.message || String(dbErr),
        },
      });
    }

    return res.json({ success: true, message: "Patient account created", auth0UserId: created.user_id });
  } catch (error) {
    console.error("/public/register-patient error:", error.response?.data || error.message || error);
    const status = error.response?.status || 500;
    const message = getReadableAuth0Error(error, error.message || "Failed to register patient");
    return res.status(status).json({ error: message });
  }
});

// Delete current account data (for test resets)
app.delete("/api/account", checkJwt, async (req, res) => {
  const sub = req.auth?.payload?.sub;
  if (!sub) {
    return res.status(400).json({ error: "Invalid token payload" });
  }

  const client = await db.connect();
  let deletedDb = false;
  let deletedAuth0 = false;
  let deletedUser = null;

  try {
    await client.query("BEGIN");
    const deleted = await client.query(
      `DELETE FROM users WHERE "auth0_id"=$1 RETURNING "UserID", "email", "role"`,
      [sub]
    );
    await client.query("COMMIT");

    if (deleted.rows.length) {
      deletedDb = true;
      deletedUser = deleted.rows[0];
    }
  } catch (error) {
    await client.query("ROLLBACK");
    await writeAuditEvent({
      req,
      eventType: "account.deleted",
      action: "delete",
      status: "failed",
      targetType: "user",
      details: {
        auth0Sub: sub,
        error: error.message || String(error),
      },
    });
    console.error("/api/account db delete error:", error.message || error);
    return res.status(500).json({ error: "Failed to delete account data from database" });
  } finally {
    client.release();
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const encodedSub = encodeURIComponent(sub);
    await axios.delete(`https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodedSub}`, {
      headers: { Authorization: `Bearer ${mgmtToken}` },
    });
    deletedAuth0 = true;
  } catch (error) {
    console.warn("/api/account Auth0 delete warning:", error.response?.data || error.message || error);
  }

  await writeAuditEvent({
    req,
    eventType: "account.deleted",
    action: "delete",
    status: deletedDb ? "success" : "failed",
    actorUserId: deletedUser?.UserID || null,
    actorRole: deletedUser?.role || null,
    targetType: "user",
    targetId: deletedUser?.UserID || sub,
    details: {
      auth0Sub: sub,
      deletedDb,
      deletedAuth0,
      deletedUser,
    },
  });

  return res.json({
    success: true,
    deletedDb,
    deletedAuth0,
    deletedUser,
  });
});

// Doctor: search patients by email or name and include relationship/request status
app.get("/api/doctor/patients/search", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const q = String(req.query.q || req.query.email || "").trim();
    if (!q) return res.status(400).json({ error: "query is required" });

    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);

    const likeQ = `%${q.toLowerCase()}%`;
    const patientUserRes = await db.query(
      `SELECT "UserID", "email", "name"
       FROM users
       WHERE "role"='patient'
         AND (LOWER("email") LIKE $1 OR LOWER(COALESCE("name", '')) LIKE $1)
       ORDER BY
         CASE WHEN LOWER("email") = LOWER($2) THEN 0 ELSE 1 END,
         "name" NULLS LAST,
         "email"
       LIMIT 20`,
      [likeQ, q]
    );

    const results = [];
    for (const patientUser of patientUserRes.rows) {
      const patientProfile = await ensurePatientProfileByUserId(patientUser.UserID);
      const relation = await db.query(
        `SELECT "RelationID", "status" FROM doctor_patient_relations WHERE "DoctorID"=$1 AND "PatientID"=$2 LIMIT 1`,
        [doctorProfile.DoctorID, patientProfile.PatientID]
      );

      const pending = await db.query(
        `SELECT "RequestID", "status", "created_at" FROM doctor_patient_match_requests
         WHERE "DoctorID"=$1 AND "PatientID"=$2 AND "status"='pending' LIMIT 1`,
        [doctorProfile.DoctorID, patientProfile.PatientID]
      );

      results.push({
        patient: {
          userId: patientUser.UserID,
          patientId: patientProfile.PatientID,
          email: patientUser.email,
          name: patientUser.name,
        },
        relation: relation.rows[0] || null,
        pendingRequest: pending.rows[0] || null,
      });
    }

    return res.json({ query: q, results });
  } catch (error) {
    console.error("/api/doctor/patients/search error:", error.message || error);
    return res.status(500).json({ error: "Failed to search patient" });
  }
});

// Doctor: send match request to patient by email
app.post("/api/doctor/match-requests", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const patientEmail = String(req.body?.patientEmail || "").trim().toLowerCase();
    const message = String(req.body?.message || "").trim().slice(0, 500);
    if (!patientEmail) return res.status(400).json({ error: "patientEmail is required" });

    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);

    const patientUserRes = await db.query(
      `SELECT "UserID", "email", "name", "role" FROM users WHERE LOWER("email")=LOWER($1) LIMIT 1`,
      [patientEmail]
    );
    if (!patientUserRes.rows.length) return res.status(404).json({ error: "Patient not found" });

    const patientUser = patientUserRes.rows[0];
    if (patientUser.role !== "patient") return res.status(400).json({ error: "Target user is not a patient" });

    const patientProfile = await ensurePatientProfileByUserId(patientUser.UserID);

    if (ENFORCE_REGION_MATCH_FOR_RELATION) {
      const doctorCountry = await getDoctorCountryByDoctorId(doctorProfile.DoctorID);
      const patientCountry = await getPatientCountryByPatientId(patientProfile.PatientID);
      if (!doctorCountry || !patientCountry) {
        return res.status(409).json({
          error: "Region is missing for doctor or patient. Both accounts must have country set before linking.",
        });
      }
      if (doctorCountry !== patientCountry) {
        return res.status(403).json({
          error: `Cross-region matching is not allowed (doctor: ${doctorCountry}, patient: ${patientCountry})`,
        });
      }
    }

    const relation = await db.query(
      `SELECT 1 FROM doctor_patient_relations WHERE "DoctorID"=$1 AND "PatientID"=$2 LIMIT 1`,
      [doctorProfile.DoctorID, patientProfile.PatientID]
    );
    if (relation.rows.length) {
      return res.status(409).json({ error: "Relationship already exists" });
    }

    const pending = await db.query(
      `SELECT "RequestID" FROM doctor_patient_match_requests WHERE "DoctorID"=$1 AND "PatientID"=$2 AND "status"='pending' LIMIT 1`,
      [doctorProfile.DoctorID, patientProfile.PatientID]
    );
    if (pending.rows.length) {
      return res.status(409).json({ error: "A pending request already exists" });
    }

    const inserted = await db.query(
      `INSERT INTO doctor_patient_match_requests ("DoctorID", "PatientID", "status", "message")
       VALUES ($1,$2,'pending',$3)
       RETURNING "RequestID", "status", "created_at"`,
      [doctorProfile.DoctorID, patientProfile.PatientID, message || null]
    );

    await writeAuditEvent({
      req,
      eventType: "relation.match_request_created",
      action: "create",
      status: "success",
      targetType: "match_request",
      targetId: inserted.rows[0]?.RequestID,
      details: {
        doctorId: doctorProfile.DoctorID,
        patientId: patientProfile.PatientID,
        patientEmail,
      },
    });

    return res.json({
      success: true,
      request: inserted.rows[0],
      patient: { email: patientUser.email, name: patientUser.name },
    });
  } catch (error) {
    console.error("/api/doctor/match-requests POST error:", error.message || error);
    await writeAuditEvent({
      req,
      eventType: "relation.match_request_created",
      action: "create",
      status: "failed",
      targetType: "match_request",
      details: {
        error: error.message || String(error),
      },
    });
    return res.status(500).json({ error: "Failed to create match request" });
  }
});

// Doctor: view pending and accepted relationship list
app.get("/api/doctor/match-requests", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);

    const pending = await db.query(
      `SELECT r."RequestID", r."status", r."message", r."created_at",
              u."name" AS patient_name, u."email" AS patient_email
       FROM doctor_patient_match_requests r
       JOIN patient_profiles pp ON pp."PatientID"=r."PatientID"
       JOIN users u ON u."UserID"=pp."UserID"
       WHERE r."DoctorID"=$1 AND r."status"='pending'
       ORDER BY r."created_at" DESC`,
      [doctorProfile.DoctorID]
    );

    const linked = await db.query(
      `SELECT rel."RelationID", rel."PatientID" AS patient_id, rel."status", rel."created_at",
              u."name" AS patient_name, u."email" AS patient_email
       FROM doctor_patient_relations rel
       JOIN patient_profiles pp ON pp."PatientID"=rel."PatientID"
       JOIN users u ON u."UserID"=pp."UserID"
       WHERE rel."DoctorID"=$1
       ORDER BY rel."created_at" DESC`,
      [doctorProfile.DoctorID]
    );

    return res.json({ pending: pending.rows, linked: linked.rows });
  } catch (error) {
    console.error("/api/doctor/match-requests GET error:", error.message || error);
    return res.status(500).json({ error: "Failed to load match requests" });
  }
});

// Doctor: unlink one patient relationship.
app.delete("/api/doctor/patients/:patientId/relation", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const patientId = Number(req.params.patientId);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);

    const removed = await db.query(
      `DELETE FROM doctor_patient_relations
       WHERE "DoctorID"=$1 AND "PatientID"=$2
       RETURNING "RelationID"`,
      [doctorProfile.DoctorID, patientId]
    );

    if (!removed.rows.length) {
      return res.status(404).json({ error: "Active relationship not found" });
    }

    await writeAuditEvent({
      req,
      eventType: "relation.unlinked_by_doctor",
      action: "delete",
      status: "success",
      targetType: "doctor_patient_relation",
      targetId: removed.rows[0].RelationID,
      details: {
        doctorId: doctorProfile.DoctorID,
        patientId,
      },
    });

    return res.json({ success: true, removedRelationId: removed.rows[0].RelationID });
  } catch (error) {
    console.error("/api/doctor/patients/:patientId/relation DELETE error:", error.message || error);
    await writeAuditEvent({
      req,
      eventType: "relation.unlinked_by_doctor",
      action: "delete",
      status: "failed",
      targetType: "doctor_patient_relation",
      details: {
        patientId: req.params?.patientId || null,
        error: error.message || String(error),
      },
    });
    return res.status(500).json({ error: "Failed to remove patient relationship" });
  }
});

// Patient: list incoming pending match requests
app.get("/api/patient/match-requests", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);

    const incoming = await db.query(
      `SELECT r."RequestID", r."status", r."message", r."created_at",
              du."name" AS doctor_name, du."email" AS doctor_email,
              hp."institution", hp."specialty"
       FROM doctor_patient_match_requests r
       JOIN doctor_profiles dp ON dp."DoctorID"=r."DoctorID"
       JOIN users du ON du."UserID"=dp."UserID"
       LEFT JOIN healthcare_providers hp ON hp."ProviderID"=dp."ProviderID"
       WHERE r."PatientID"=$1 AND r."status"='pending'
       ORDER BY r."created_at" DESC`,
      [patientProfile.PatientID]
    );

    return res.json({ requests: incoming.rows });
  } catch (error) {
    console.error("/api/patient/match-requests GET error:", error.message || error);
    return res.status(500).json({ error: "Failed to load incoming requests" });
  }
});

// Patient: respond to incoming request (accept/reject)
app.post("/api/patient/match-requests/:requestId/respond", checkJwt, requireRole("patient"), async (req, res) => {
  const requestId = Number(req.params.requestId);
  const action = String(req.body?.action || "").toLowerCase();
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ error: "Invalid requestId" });
  }
  if (!["accept", "reject"].includes(action)) {
    return res.status(400).json({ error: "action must be accept or reject" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);
    const reqRowRes = await client.query(
      `SELECT "RequestID", "DoctorID", "PatientID", "status"
       FROM doctor_patient_match_requests
       WHERE "RequestID"=$1
       FOR UPDATE`,
      [requestId]
    );

    if (!reqRowRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Request not found" });
    }

    const reqRow = reqRowRes.rows[0];
    if (reqRow.PatientID !== patientProfile.PatientID) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Not allowed to respond to this request" });
    }
    if (reqRow.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Request is already resolved" });
    }

    if (ENFORCE_REGION_MATCH_FOR_RELATION) {
      const doctorCountry = await getDoctorCountryByDoctorId(reqRow.DoctorID, client);
      const patientCountry = await getPatientCountryByPatientId(reqRow.PatientID, client);
      if (!doctorCountry || !patientCountry) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Region is missing for doctor or patient. Both accounts must have country set before linking.",
        });
      }
      if (doctorCountry !== patientCountry) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: `Cross-region matching is not allowed (doctor: ${doctorCountry}, patient: ${patientCountry})`,
        });
      }
    }

    if (action === "accept") {
      await client.query(
        `INSERT INTO doctor_patient_relations ("DoctorID", "PatientID", "start_date", "status")
         VALUES ($1,$2,CURRENT_DATE,'active')
         ON CONFLICT ("DoctorID", "PatientID") DO UPDATE SET "status"='active'`,
        [reqRow.DoctorID, reqRow.PatientID]
      );
    }

    await client.query(
      `UPDATE doctor_patient_match_requests
       SET "status"=$1, "responded_at"=CURRENT_TIMESTAMP
       WHERE "RequestID"=$2`,
      [action === "accept" ? "accepted" : "rejected", requestId]
    );

    await writeAuditEvent({
      client,
      req,
      eventType: "relation.match_request_responded",
      action: "update",
      status: "success",
      targetType: "match_request",
      targetId: requestId,
      details: {
        action,
        doctorId: reqRow.DoctorID,
        patientId: reqRow.PatientID,
      },
    });

    await client.query("COMMIT");
    return res.json({ success: true, action });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("/api/patient/match-requests/:id/respond error:", error.message || error);
    await writeAuditEvent({
      req,
      eventType: "relation.match_request_responded",
      action: "update",
      status: "failed",
      targetType: "match_request",
      targetId: requestId,
      details: {
        action,
        error: error.message || String(error),
      },
    });
    return res.status(500).json({ error: "Failed to respond to request" });
  } finally {
    client.release();
  }
});

// Patient: list doctors already linked with this patient.
app.get("/api/patient/linked-doctors", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);
    const doctors = await db.query(
      `SELECT dpr."RelationID", dpr."status", dpr."created_at",
              dp."DoctorID", du."name" AS doctor_name, du."email" AS doctor_email,
              COALESCE(NULLIF(TRIM(du."name"), ''), NULLIF(TRIM(hp.provider_name), ''), du."email") AS doctor_display_name,
              hp.provider_name,
              hp."institution", hp."specialty"
       FROM doctor_patient_relations dpr
       JOIN doctor_profiles dp ON dp."DoctorID"=dpr."DoctorID"
       JOIN users du ON du."UserID"=dp."UserID"
       LEFT JOIN healthcare_providers hp ON hp."ProviderID"=dp."ProviderID"
       WHERE dpr."PatientID"=$1
       ORDER BY dpr."created_at" DESC`,
      [patientProfile.PatientID]
    );

    return res.json({ doctors: doctors.rows });
  } catch (error) {
    console.error("/api/patient/linked-doctors error:", error.message || error);
    return res.status(500).json({ error: "Failed to load linked doctors" });
  }
});

// Patient: list supported health metric types used by report form.
app.get("/api/patient/health-metric-types", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const metricTypes = await db.query(
      `SELECT "MetricTypeID" AS metric_type_id, name, unit, min_value, max_value, description
       FROM health_metric_types
       ORDER BY name ASC`
    );
    return res.json({ metricTypes: metricTypes.rows });
  } catch (error) {
    console.error("/api/patient/health-metric-types error:", error.message || error);
    return res.status(500).json({ error: "Failed to load health metric types" });
  }
});

// Patient: submit a structured daily report with multiple metric values.
app.post("/api/patient/reports", checkJwt, requireRole("patient"), async (req, res) => {
  const note = String(req.body?.note || "").trim().slice(0, 2000);

  const metricPayload = {
    "Blood Pressure Systolic": parseOptionalNumber(req.body?.bloodPressureSystolic),
    "Blood Pressure Diastolic": parseOptionalNumber(req.body?.bloodPressureDiastolic),
    Weight: parseOptionalNumber(req.body?.weightKg),
    "Sleep Duration": parseOptionalNumber(req.body?.sleepHours),
    "Sleep Quality": parseOptionalNumber(req.body?.sleepQuality),
    "Pain Level": parseOptionalNumber(req.body?.painLevel),
  };

  const providedMetrics = Object.entries(metricPayload).filter(([, value]) => value !== null);
  if (!providedMetrics.length) {
    return res.status(400).json({ error: "At least one metric value is required" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);
    const profileRow = await client.query(
      `SELECT "PatientID" FROM patient_profiles WHERE "PatientID"=$1 FOR UPDATE`,
      [patientProfile.PatientID]
    );
    if (!profileRow.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Patient profile not found" });
    }

    const { start: dayStart, end: dayEnd } = getLocalDayBounds();
    const existingToday = await client.query(
      `SELECT "RecordID", "recorded_at"
       FROM patient_metric_records
       WHERE "PatientID"=$1 AND "recorded_at" >= $2 AND "recorded_at" < $3
       ORDER BY "recorded_at" ASC, "RecordID" ASC
       FOR UPDATE`,
      [patientProfile.PatientID, dayStart.toISOString(), dayEnd.toISOString()]
    );

    const typeRows = await client.query(
      `SELECT "MetricTypeID" AS metric_type_id, name, min_value, max_value
       FROM health_metric_types
       WHERE LOWER(name) = ANY($1::text[])`,
      [providedMetrics.map(([name]) => name.toLowerCase())]
    );

    const typeMap = new Map(typeRows.rows.map((row) => [String(row.name || "").toLowerCase(), row]));
    const missingTypes = providedMetrics
      .map(([name]) => name)
      .filter((name) => !typeMap.has(name.toLowerCase()));
    if (missingTypes.length) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        error: `Missing health metric types: ${missingTypes.join(", ")}`,
      });
    }

    let insertedCount = 0;
    const isUpdate = existingToday.rows.length > 0;
    const effectiveRecordedAt = isUpdate
      ? new Date(existingToday.rows[0].recorded_at)
      : new Date();
    if (isUpdate) {
      await client.query(
        `DELETE FROM patient_metric_records
         WHERE "PatientID"=$1 AND "recorded_at" >= $2 AND "recorded_at" < $3`,
        [patientProfile.PatientID, dayStart.toISOString(), dayEnd.toISOString()]
      );
    }

    for (const [metricName, metricValue] of providedMetrics) {
      const metricType = typeMap.get(metricName.toLowerCase());
      if (!metricType) continue;

      const min = metricType.min_value === null ? null : Number(metricType.min_value);
      const max = metricType.max_value === null ? null : Number(metricType.max_value);
      if ((min !== null && metricValue < min) || (max !== null && metricValue > max)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `${metricName} must be between ${min ?? "-inf"} and ${max ?? "inf"}`,
        });
      }

      await client.query(
        `INSERT INTO patient_metric_records ("PatientID", "MetricTypeID", "value", "recorded_at", "source", "notes")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          patientProfile.PatientID,
          metricType.metric_type_id,
          metricValue,
          effectiveRecordedAt.toISOString(),
          "manual",
          note || null,
        ]
      );
      insertedCount += 1;
    }

    await writeAuditEvent({
      client,
      req,
      eventType: "patient.report_submitted",
      action: isUpdate ? "update" : "create",
      status: "success",
      targetType: "patient_daily_report",
      targetId: patientProfile.PatientID,
      details: {
        mode: isUpdate ? "updated" : "created",
        insertedCount,
        recordedAt: effectiveRecordedAt.toISOString(),
      },
    });

    await client.query("COMMIT");
    return res.json({
      success: true,
      mode: isUpdate ? "updated" : "created",
      insertedCount,
      recordedAt: effectiveRecordedAt.toISOString(),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("/api/patient/reports POST error:", error.message || error);
    await writeAuditEvent({
      req,
      eventType: "patient.report_submitted",
      action: "upsert",
      status: "failed",
      targetType: "patient_daily_report",
      details: {
        error: error.message || String(error),
      },
    });
    return res.status(500).json({ error: "Failed to submit patient report" });
  } finally {
    client.release();
  }
});

// Patient: fetch today's report (single daily report, if exists).
app.get("/api/patient/reports/today", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);
    const { start: dayStart, end: dayEnd } = getLocalDayBounds();

    const rows = await db.query(
      `SELECT
          r."RecordID" AS record_id,
          r."recorded_at",
          r."value",
          r."notes",
          t.name AS metric_name,
          t.unit AS metric_unit
       FROM patient_metric_records r
       JOIN health_metric_types t ON t."MetricTypeID"=r."MetricTypeID"
       WHERE r."PatientID"=$1 AND r."recorded_at" >= $2 AND r."recorded_at" < $3
       ORDER BY t.name ASC, r."RecordID" ASC`,
      [patientProfile.PatientID, dayStart.toISOString(), dayEnd.toISOString()]
    );

    const metrics = {
      bloodPressureSystolic: "",
      bloodPressureDiastolic: "",
      weightKg: "",
      sleepHours: "",
      sleepQuality: "",
      painLevel: "",
    };

    for (const row of rows.rows) {
      const metricName = String(row.metric_name || "").toLowerCase();
      if (metricName === "blood pressure systolic") metrics.bloodPressureSystolic = String(row.value ?? "");
      if (metricName === "blood pressure diastolic") metrics.bloodPressureDiastolic = String(row.value ?? "");
      if (metricName === "weight") metrics.weightKg = String(row.value ?? "");
      if (metricName === "sleep duration") metrics.sleepHours = String(row.value ?? "");
      if (metricName === "sleep quality") metrics.sleepQuality = String(row.value ?? "");
      if (metricName === "pain level") metrics.painLevel = String(row.value ?? "");
    }

    return res.json({
      hasReport: rows.rows.length > 0,
      recordedAt: rows.rows[0]?.recorded_at || null,
      note: rows.rows[0]?.notes || "",
      metrics,
    });
  } catch (error) {
    console.error("/api/patient/reports/today GET error:", error.message || error);
    return res.status(500).json({ error: "Failed to load today's report" });
  }
});

// Patient: fetch recent report rows for personal timeline.
app.get("/api/patient/reports", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 100;
    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);

    const records = await db.query(
      `SELECT
          r."RecordID" AS record_id,
          r."recorded_at",
          r."value",
          r."source",
          r."notes",
          t."MetricTypeID" AS metric_type_id,
          t.name AS metric_name,
          t.unit AS metric_unit
       FROM patient_metric_records r
       JOIN health_metric_types t ON t."MetricTypeID"=r."MetricTypeID"
       WHERE r."PatientID"=$1
       ORDER BY r."recorded_at" DESC, r."RecordID" DESC
       LIMIT $2`,
      [patientProfile.PatientID, limit]
    );

    return res.json({ records: records.rows });
  } catch (error) {
    console.error("/api/patient/reports GET error:", error.message || error);
    return res.status(500).json({ error: "Failed to load patient reports" });
  }
});

// Patient: fetch paginated report entries (one entry per submission timestamp).
app.get("/api/patient/reports/paged", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const pageRaw = Number(req.query.page);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 7;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const offset = (page - 1) * limit;

    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);

    const totalRes = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM (
         SELECT DISTINCT r."recorded_at"
         FROM patient_metric_records r
         WHERE r."PatientID"=$1
       ) x`,
      [patientProfile.PatientID]
    );
    const total = totalRes.rows[0]?.total || 0;
    const pages = total > 0 ? Math.ceil(total / limit) : 1;

    const reportSlots = await db.query(
      `SELECT
          r."recorded_at",
          MAX(r."notes") AS notes,
          COUNT(*)::int AS metric_count
       FROM patient_metric_records r
       WHERE r."PatientID"=$1
       GROUP BY r."recorded_at"
       ORDER BY r."recorded_at" DESC
       LIMIT $2 OFFSET $3`,
      [patientProfile.PatientID, limit, offset]
    );

    const selectedTimes = reportSlots.rows.map((row) => row.recorded_at);
    let reportRecords = [];
    if (selectedTimes.length) {
      const rawRecords = await db.query(
        `SELECT
            r."RecordID" AS record_id,
            r."recorded_at",
            r."value",
            r."source",
            r."notes",
            t.name AS metric_name,
            t.unit AS metric_unit
         FROM patient_metric_records r
         JOIN health_metric_types t ON t."MetricTypeID"=r."MetricTypeID"
         WHERE r."PatientID"=$1 AND r."recorded_at" = ANY($2::timestamp[])
         ORDER BY r."recorded_at" DESC, t.name ASC, r."RecordID" ASC`,
        [patientProfile.PatientID, selectedTimes]
      );
      reportRecords = rawRecords.rows;
    }

    return res.json({
      reportSlots: reportSlots.rows,
      reportRecords,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    console.error("/api/patient/reports/paged GET error:", error.message || error);
    return res.status(500).json({ error: "Failed to load paginated patient reports" });
  }
});

// Patient profile: read editable demographic fields from patient_profiles.
app.get("/api/patient/profile", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);
    const profile = await db.query(
      `SELECT
          pp."PatientID" AS patient_id,
          pp."height_cm",
          pp."weight_kg",
          pp."blood_type",
          pp."address",
          pp."emergency_contact",
          u."name" AS display_name,
          u."email" AS email
       FROM patient_profiles pp
       JOIN users u ON u."UserID"=pp."UserID"
       WHERE pp."PatientID"=$1
       LIMIT 1`,
      [patientProfile.PatientID]
    );

    if (!profile.rows.length) {
      return res.status(404).json({ error: "Patient profile not found" });
    }

    return res.json({ profile: profile.rows[0] });
  } catch (error) {
    console.error("/api/patient/profile GET error:", error.message || error);
    return res.status(500).json({ error: "Failed to load patient profile" });
  }
});

// Patient profile: update editable demographic fields in patient_profiles.
app.put("/api/patient/profile", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);

    const parseOptionalDecimal = (value) => {
      if (value === undefined || value === null || value === "") return null;
      const next = Number(value);
      return Number.isFinite(next) ? next : NaN;
    };

    const heightCm = parseOptionalDecimal(req.body?.heightCm);
    const weightKg = parseOptionalDecimal(req.body?.weightKg);
    if (Number.isNaN(heightCm) || Number.isNaN(weightKg)) {
      return res.status(400).json({ error: "heightCm and weightKg must be valid numbers" });
    }

    const bloodTypeRaw = String(req.body?.bloodType || "").trim();
    const bloodType = bloodTypeRaw ? bloodTypeRaw.toUpperCase().slice(0, 10) : null;
    const address = String(req.body?.address || "").trim().slice(0, 1000) || null;
    const emergencyContact = String(req.body?.emergencyContact || "").trim().slice(0, 255) || null;

    const updated = await db.query(
      `UPDATE patient_profiles
       SET
         "height_cm"=$1,
         "weight_kg"=$2,
         "blood_type"=$3,
         "address"=$4,
         "emergency_contact"=$5
       WHERE "PatientID"=$6
       RETURNING "PatientID" AS patient_id, "height_cm", "weight_kg", "blood_type", "address", "emergency_contact"`,
      [heightCm, weightKg, bloodType, address, emergencyContact, patientProfile.PatientID]
    );

    await writeAuditEvent({
      req,
      eventType: "patient.profile_updated",
      action: "update",
      status: "success",
      targetType: "patient_profile",
      targetId: patientProfile.PatientID,
      details: {
        heightCm,
        weightKg,
        bloodType,
        address,
        emergencyContact,
      },
    });

    return res.json({ success: true, profile: updated.rows[0] });
  } catch (error) {
    console.error("/api/patient/profile PUT error:", error.message || error);
    await writeAuditEvent({
      req,
      eventType: "patient.profile_updated",
      action: "update",
      status: "failed",
      targetType: "patient_profile",
      details: {
        error: error.message || String(error),
      },
    });
    return res.status(500).json({ error: "Failed to update patient profile" });
  }
});

// Doctor: list linked patients with latest report timestamp for overview page.
app.get("/api/doctor/reports/patients", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);
    const rows = await db.query(
      `SELECT
          pp."PatientID" AS patient_id,
          u."name" AS patient_name,
          u."email" AS patient_email,
          MAX(r."recorded_at") AS last_report_at
       FROM doctor_patient_relations rel
       JOIN patient_profiles pp ON pp."PatientID"=rel."PatientID"
       JOIN users u ON u."UserID"=pp."UserID"
       LEFT JOIN patient_metric_records r ON r."PatientID"=pp."PatientID"
       WHERE rel."DoctorID"=$1 AND LOWER(rel."status"::text)='active'
       GROUP BY pp."PatientID", u."name", u."email"
       ORDER BY MAX(r."recorded_at") DESC NULLS LAST, u."name" ASC, u."email" ASC`,
      [doctorProfile.DoctorID]
    );

    return res.json({ patients: rows.rows });
  } catch (error) {
    console.error("/api/doctor/reports/patients error:", error.message || error);
    return res.status(500).json({ error: "Failed to load patient reports overview" });
  }
});

// Doctor: fetch 7-day averages for one linked patient.
app.get("/api/doctor/reports/patients/:patientId/averages", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const patientId = Number(req.params.patientId);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);
    const relation = await db.query(
      `SELECT 1 FROM doctor_patient_relations WHERE "DoctorID"=$1 AND "PatientID"=$2 AND LOWER("status"::text)='active' LIMIT 1`,
      [doctorProfile.DoctorID, patientId]
    );
    if (!relation.rows.length) {
      return res.status(403).json({ error: "Patient is not linked to this doctor" });
    }

    const averages = await db.query(
      `SELECT
          t.name AS metric_name,
          t.unit AS metric_unit,
          AVG(r."value")::numeric(10,2) AS avg_value
       FROM patient_metric_records r
       JOIN health_metric_types t ON t."MetricTypeID"=r."MetricTypeID"
       WHERE r."PatientID"=$1 AND r."recorded_at" >= NOW() - INTERVAL '7 days'
       GROUP BY t.name, t.unit
       ORDER BY t.name ASC`,
      [patientId]
    );

    return res.json({ averages: averages.rows });
  } catch (error) {
    console.error("/api/doctor/reports/patients/:patientId/averages error:", error.message || error);
    return res.status(500).json({ error: "Failed to load patient averages" });
  }
});

// Doctor: fetch one linked patient's detailed report data (averages, trends, paginated report entries).
app.get("/api/doctor/reports/patients/:patientId", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const patientId = Number(req.params.patientId);
    const limitRaw = Number(req.query.limit);
    const pageRaw = Number(req.query.page);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 7;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const offset = (page - 1) * limit;

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);
    const relation = await db.query(
      `SELECT 1 FROM doctor_patient_relations WHERE "DoctorID"=$1 AND "PatientID"=$2 AND LOWER("status"::text)='active' LIMIT 1`,
      [doctorProfile.DoctorID, patientId]
    );
    if (!relation.rows.length) {
      return res.status(403).json({ error: "Patient is not linked to this doctor" });
    }

    const patientRow = await db.query(
      `SELECT pp."PatientID" AS patient_id, u."name" AS patient_name, u."email" AS patient_email
       FROM patient_profiles pp
       JOIN users u ON u."UserID"=pp."UserID"
       WHERE pp."PatientID"=$1
       LIMIT 1`,
      [patientId]
    );
    if (!patientRow.rows.length) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const averages = await db.query(
      `SELECT
          t.name AS metric_name,
          t.unit AS metric_unit,
          AVG(r."value")::numeric(10,2) AS avg_value
       FROM patient_metric_records r
       JOIN health_metric_types t ON t."MetricTypeID"=r."MetricTypeID"
       WHERE r."PatientID"=$1 AND r."recorded_at" >= NOW() - INTERVAL '7 days'
       GROUP BY t.name, t.unit
       ORDER BY t.name ASC`,
      [patientId]
    );

    const trendRecords = await db.query(
      `SELECT
          r."RecordID" AS record_id,
          r."recorded_at",
          r."value",
          r."notes",
          t.name AS metric_name,
          t.unit AS metric_unit
       FROM patient_metric_records r
       JOIN health_metric_types t ON t."MetricTypeID"=r."MetricTypeID"
       WHERE r."PatientID"=$1 AND r."recorded_at" >= NOW() - INTERVAL '7 days'
       ORDER BY r."recorded_at" DESC, r."RecordID" DESC`,
      [patientId]
    );

    const totalRes = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM (
         SELECT DISTINCT r."recorded_at"
         FROM patient_metric_records r
         WHERE r."PatientID"=$1
       ) x`,
      [patientId]
    );
    const total = totalRes.rows[0]?.total || 0;
    const pages = total > 0 ? Math.ceil(total / limit) : 1;

    const reportSlots = await db.query(
      `SELECT
          r."recorded_at",
          MAX(r."notes") AS notes,
          COUNT(*)::int AS metric_count
       FROM patient_metric_records r
       WHERE r."PatientID"=$1
       GROUP BY r."recorded_at"
       ORDER BY r."recorded_at" DESC
       LIMIT $2 OFFSET $3`,
      [patientId, limit, offset]
    );

    const selectedTimes = reportSlots.rows.map((row) => row.recorded_at);
    let reportRecords = [];
    if (selectedTimes.length) {
      const rawRecords = await db.query(
        `SELECT
            r."RecordID" AS record_id,
            r."recorded_at",
            r."value",
            r."source",
            r."notes",
            t.name AS metric_name,
            t.unit AS metric_unit
         FROM patient_metric_records r
         JOIN health_metric_types t ON t."MetricTypeID"=r."MetricTypeID"
         WHERE r."PatientID"=$1 AND r."recorded_at" = ANY($2::timestamp[])
         ORDER BY r."recorded_at" DESC, t.name ASC, r."RecordID" ASC`,
        [patientId, selectedTimes]
      );
      reportRecords = rawRecords.rows;
    }

    return res.json({
      patient: patientRow.rows[0],
      averages: averages.rows,
      trendRecords: trendRecords.rows,
      reportSlots: reportSlots.rows,
      reportRecords,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    console.error("/api/doctor/reports/patients/:patientId error:", error.message || error);
    return res.status(500).json({ error: "Failed to load patient report details" });
  }
});

// Doctor: create one advice for a linked patient.
app.post("/api/doctor/patients/:patientId/advices", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const patientId = Number(req.params.patientId);
    const content = String(req.body?.content || "").trim().slice(0, 3000);
    const urgency = normalizeAdviceUrgency(req.body?.urgency);

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({ error: "Invalid patientId" });
    }
    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }
    if (!urgency) {
      return res.status(400).json({ error: "urgency must be one of: urgent, normal, low" });
    }

    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);
    const relation = await db.query(
      `SELECT 1 FROM doctor_patient_relations WHERE "DoctorID"=$1 AND "PatientID"=$2 AND LOWER("status"::text)='active' LIMIT 1`,
      [doctorProfile.DoctorID, patientId]
    );
    if (!relation.rows.length) {
      return res.status(403).json({ error: "Patient is not linked to this doctor" });
    }

    const inserted = await db.query(
      `INSERT INTO patient_advices ("DoctorID", "PatientID", "content", "urgency")
       VALUES ($1,$2,$3,$4)
       RETURNING "AdviceID", "DoctorID", "PatientID", "content", "urgency", "is_acknowledged", "acknowledged_at", "created_at"`,
      [doctorProfile.DoctorID, patientId, content, urgency]
    );

    await writeAuditEvent({
      req,
      eventType: "doctor.advice_created",
      action: "create",
      status: "success",
      targetType: "patient_advice",
      targetId: inserted.rows[0]?.AdviceID,
      details: {
        doctorId: doctorProfile.DoctorID,
        patientId,
        urgency,
      },
    });

    return res.json({ success: true, advice: inserted.rows[0] });
  } catch (error) {
    console.error("/api/doctor/patients/:patientId/advices POST error:", error.message || error);
    await writeAuditEvent({
      req,
      eventType: "doctor.advice_created",
      action: "create",
      status: "failed",
      targetType: "patient_advice",
      targetId: req.params?.patientId || null,
      details: {
        error: error.message || String(error),
      },
    });
    return res.status(500).json({ error: "Failed to create patient advice" });
  }
});

// Doctor: list recent advices for one linked patient with pagination.
app.get("/api/doctor/patients/:patientId/advices", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const patientId = Number(req.params.patientId);
    const limitRaw = Number(req.query.limit);
    const pageRaw = Number(req.query.page);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 5;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const offset = (page - 1) * limit;

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);
    const relation = await db.query(
      `SELECT 1 FROM doctor_patient_relations WHERE "DoctorID"=$1 AND "PatientID"=$2 AND LOWER("status"::text)='active' LIMIT 1`,
      [doctorProfile.DoctorID, patientId]
    );
    if (!relation.rows.length) {
      return res.status(403).json({ error: "Patient is not linked to this doctor" });
    }

    const totalRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM patient_advices WHERE "DoctorID"=$1 AND "PatientID"=$2`,
      [doctorProfile.DoctorID, patientId]
    );
    const total = totalRes.rows[0]?.total || 0;
    const pages = total > 0 ? Math.ceil(total / limit) : 1;

    const advices = await db.query(
      `SELECT
          "AdviceID",
          "content",
          "urgency",
          "is_acknowledged",
          "acknowledged_at",
          "created_at"
       FROM patient_advices
       WHERE "DoctorID"=$1 AND "PatientID"=$2
       ORDER BY "created_at" DESC
       LIMIT $3 OFFSET $4`,
      [doctorProfile.DoctorID, patientId, limit, offset]
    );

    return res.json({
      advices: advices.rows,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    console.error("/api/doctor/patients/:patientId/advices GET error:", error.message || error);
    return res.status(500).json({ error: "Failed to load patient advice history" });
  }
});

// Patient: list all advices with pagination.
app.get("/api/patient/advices", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const pageRaw = Number(req.query.page);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 5;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const offset = (page - 1) * limit;

    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);

    const totalRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM patient_advices WHERE "PatientID"=$1`,
      [patientProfile.PatientID]
    );
    const total = totalRes.rows[0]?.total || 0;
    const pages = total > 0 ? Math.ceil(total / limit) : 1;

    const advices = await db.query(
      `SELECT
          a."AdviceID",
          a."content",
          a."urgency",
          a."is_acknowledged",
          a."acknowledged_at",
          a."created_at",
          du."name" AS doctor_name,
          du."email" AS doctor_email
       FROM patient_advices a
       JOIN doctor_profiles dp ON dp."DoctorID"=a."DoctorID"
       JOIN users du ON du."UserID"=dp."UserID"
       WHERE a."PatientID"=$1
       ORDER BY a."created_at" DESC
       LIMIT $2 OFFSET $3`,
      [patientProfile.PatientID, limit, offset]
    );

    return res.json({
      advices: advices.rows,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    console.error("/api/patient/advices GET error:", error.message || error);
    return res.status(500).json({ error: "Failed to load patient advices" });
  }
});

// Patient: acknowledge receipt for one advice.
app.post("/api/patient/advices/:adviceId/acknowledge", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const adviceId = Number(req.params.adviceId);
    if (!Number.isInteger(adviceId) || adviceId <= 0) {
      return res.status(400).json({ error: "Invalid adviceId" });
    }

    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);
    const updated = await db.query(
      `UPDATE patient_advices
       SET "is_acknowledged"=TRUE,
           "acknowledged_at"=COALESCE("acknowledged_at", CURRENT_TIMESTAMP)
       WHERE "AdviceID"=$1 AND "PatientID"=$2
       RETURNING "AdviceID", "is_acknowledged", "acknowledged_at"`,
      [adviceId, patientProfile.PatientID]
    );

    if (!updated.rows.length) {
      return res.status(404).json({ error: "Advice not found" });
    }

    await writeAuditEvent({
      req,
      eventType: "patient.advice_acknowledged",
      action: "update",
      status: "success",
      targetType: "patient_advice",
      targetId: adviceId,
      details: {
        patientId: patientProfile.PatientID,
      },
    });

    return res.json({ success: true, advice: updated.rows[0] });
  } catch (error) {
    console.error("/api/patient/advices/:adviceId/acknowledge POST error:", error.message || error);
    await writeAuditEvent({
      req,
      eventType: "patient.advice_acknowledged",
      action: "update",
      status: "failed",
      targetType: "patient_advice",
      targetId: req.params?.adviceId || null,
      details: {
        error: error.message || String(error),
      },
    });
    return res.status(500).json({ error: "Failed to acknowledge advice" });
  }
});

// Patient: list appointment slots for a linked doctor (available + unavailable).
app.get("/api/patient/doctors/:doctorId/slots", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const doctorId = Number(req.params.doctorId);
    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      return res.status(400).json({ error: "Invalid doctorId" });
    }

    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);
    const relation = await db.query(
      `SELECT 1 FROM doctor_patient_relations WHERE "DoctorID"=$1 AND "PatientID"=$2 AND LOWER("status"::text)='active' LIMIT 1`,
      [doctorId, patientProfile.PatientID]
    );
    if (!relation.rows.length) {
      return res.status(403).json({ error: "Doctor is not linked to this patient" });
    }

    await ensureDefaultSlotsForDoctor(doctorId);

    const slots = await db.query(
      `SELECT
          s."SlotID",
          s."start_time",
          s."end_time",
          s."is_booked",
          COALESCE(a."is_available", TRUE) AS "is_available"
       FROM appointment_slots s
       LEFT JOIN appointment_slot_availability a ON a."SlotID"=s."SlotID"
       WHERE s."DoctorID"=$1
         AND s."start_time">NOW()
       ORDER BY s."start_time" ASC`,
      [doctorId]
    );
    return res.json({ slots: slots.rows });
  } catch (error) {
    console.error("/api/patient/doctors/:doctorId/slots error:", error.message || error);
    return res.status(500).json({ error: "Failed to load doctor slots" });
  }
});

// Patient: submit appointment request for a doctor slot.
app.post("/api/patient/appointments", checkJwt, requireRole("patient"), async (req, res) => {
  const doctorId = Number(req.body?.doctorId);
  const slotId = Number(req.body?.slotId);
  const reason = String(req.body?.reason || "").trim().slice(0, 1000);

  if (!Number.isInteger(doctorId) || doctorId <= 0) {
    return res.status(400).json({ error: "Invalid doctorId" });
  }
  if (!Number.isInteger(slotId) || slotId <= 0) {
    return res.status(400).json({ error: "Invalid slotId" });
  }
  if (!reason) {
    return res.status(400).json({ error: "reason is required" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);

    const relation = await client.query(
      `SELECT 1 FROM doctor_patient_relations WHERE "DoctorID"=$1 AND "PatientID"=$2 AND LOWER("status"::text)='active' LIMIT 1`,
      [doctorId, patientProfile.PatientID]
    );
    if (!relation.rows.length) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Doctor is not linked to this patient" });
    }

    const slotRes = await client.query(
      `SELECT s."SlotID", s."DoctorID", s."is_booked", COALESCE(a."is_available", TRUE) AS "is_available", s."start_time"
       FROM appointment_slots s
       LEFT JOIN appointment_slot_availability a ON a."SlotID"=s."SlotID"
       WHERE s."SlotID"=$1
       FOR UPDATE OF s`,
      [slotId]
    );
    if (!slotRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Slot not found" });
    }

    const slot = slotRes.rows[0];
    if (slot.DoctorID !== doctorId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Slot does not belong to this doctor" });
    }
    if (slot.is_booked) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Slot already booked" });
    }
    if (!slot.is_available) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Slot is not available" });
    }

    const created = await client.query(
      `INSERT INTO appointments ("DoctorID", "PatientID", "SlotID", "status", "reason")
       VALUES ($1,$2,$3,'pending',$4)
       RETURNING "AppointmentID", "status", "created_at"`,
      [doctorId, patientProfile.PatientID, slotId, reason]
    );

    await client.query(`UPDATE appointment_slots SET "is_booked"=TRUE WHERE "SlotID"=$1`, [slotId]);

    await writeAuditEvent({
      client,
      req,
      eventType: "appointment.request_created",
      action: "create",
      status: "success",
      targetType: "appointment",
      targetId: created.rows[0]?.AppointmentID,
      details: {
        doctorId,
        patientId: patientProfile.PatientID,
        slotId,
      },
    });

    await client.query("COMMIT");
    return res.json({ success: true, appointment: created.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("/api/patient/appointments POST error:", error.message || error);
    await writeAuditEvent({
      req,
      eventType: "appointment.request_created",
      action: "create",
      status: "failed",
      targetType: "appointment",
      details: {
        doctorId,
        slotId,
        error: error.message || String(error),
      },
    });
    return res.status(500).json({ error: "Failed to create appointment request" });
  } finally {
    client.release();
  }
});

// Patient notifications: incoming doctor match requests + appointment updates.
app.get("/api/patient/notifications", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);

    const incomingMatches = await db.query(
      `SELECT r."RequestID", r."status", r."message", r."created_at",
              du."name" AS doctor_name, du."email" AS doctor_email
       FROM doctor_patient_match_requests r
       JOIN doctor_profiles dp ON dp."DoctorID"=r."DoctorID"
       JOIN users du ON du."UserID"=dp."UserID"
       WHERE r."PatientID"=$1 AND r."status"='pending'
       ORDER BY r."created_at" DESC`,
      [patientProfile.PatientID]
    );

    const appointments = await db.query(
      `SELECT a."AppointmentID", a."status", a."reason", a."created_at",
              s."start_time", s."end_time",
              du."name" AS doctor_name, du."email" AS doctor_email
       FROM appointments a
       JOIN appointment_slots s ON s."SlotID"=a."SlotID"
       JOIN doctor_profiles dp ON dp."DoctorID"=a."DoctorID"
       JOIN users du ON du."UserID"=dp."UserID"
       WHERE a."PatientID"=$1
       ORDER BY a."created_at" DESC`,
      [patientProfile.PatientID]
    );

    const advices = await db.query(
      `SELECT
          a."AdviceID",
          a."content",
          a."urgency",
          a."created_at",
          du."name" AS doctor_name,
          du."email" AS doctor_email
       FROM patient_advices a
       JOIN doctor_profiles dp ON dp."DoctorID"=a."DoctorID"
       JOIN users du ON du."UserID"=dp."UserID"
       WHERE a."PatientID"=$1 AND a."is_acknowledged"=FALSE
       ORDER BY a."created_at" DESC`,
      [patientProfile.PatientID]
    );

    return res.json({ incomingMatches: incomingMatches.rows, appointments: appointments.rows, advices: advices.rows });
  } catch (error) {
    console.error("/api/patient/notifications error:", error.message || error);
    return res.status(500).json({ error: "Failed to load patient notifications" });
  }
});

// Doctor notifications: pending appointment requests + pending patient links.
app.get("/api/doctor/notifications", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);

    const appointmentRequests = await db.query(
      `SELECT a."AppointmentID", a."status", a."reason", a."created_at",
              s."SlotID", s."start_time", s."end_time",
              pu."name" AS patient_name, pu."email" AS patient_email
       FROM appointments a
       JOIN appointment_slots s ON s."SlotID"=a."SlotID"
       JOIN patient_profiles pp ON pp."PatientID"=a."PatientID"
       JOIN users pu ON pu."UserID"=pp."UserID"
       WHERE a."DoctorID"=$1 AND a."status"='pending'
       ORDER BY a."created_at" DESC`,
      [doctorProfile.DoctorID]
    );

    const matchRequests = await db.query(
      `SELECT r."RequestID", r."status", r."message", r."created_at",
              pu."name" AS patient_name, pu."email" AS patient_email
       FROM doctor_patient_match_requests r
       JOIN patient_profiles pp ON pp."PatientID"=r."PatientID"
       JOIN users pu ON pu."UserID"=pp."UserID"
       WHERE r."DoctorID"=$1 AND r."status"='pending'
       ORDER BY r."created_at" DESC`,
      [doctorProfile.DoctorID]
    );

    return res.json({ appointmentRequests: appointmentRequests.rows, pendingMatches: matchRequests.rows });
  } catch (error) {
    console.error("/api/doctor/notifications error:", error.message || error);
    return res.status(500).json({ error: "Failed to load doctor notifications" });
  }
});

// Doctor dashboard: core overview cards and lists for today's workflow.
app.get("/api/doctor/dashboard", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);

    const [
      linkedPatientsTotalRes,
      pendingAppointmentRequestsRes,
      pendingMatchRequestsRes,
      pendingAdviceReceiptsRes,
      upcomingAppointmentsRes,
      recentAdvicesRes,
    ] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM doctor_patient_relations
         WHERE "DoctorID"=$1 AND LOWER("status"::text)='active'`,
        [doctorProfile.DoctorID]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM appointments
         WHERE "DoctorID"=$1 AND "status"='pending'`,
        [doctorProfile.DoctorID]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM doctor_patient_match_requests
         WHERE "DoctorID"=$1 AND "status"='pending'`,
        [doctorProfile.DoctorID]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM patient_advices
         WHERE "DoctorID"=$1 AND "is_acknowledged"=FALSE`,
        [doctorProfile.DoctorID]
      ),
      db.query(
        `SELECT
            a."AppointmentID",
            a."status",
            a."reason",
            s."start_time",
            s."end_time",
            pu."name" AS patient_name,
            pu."email" AS patient_email
         FROM appointments a
         JOIN appointment_slots s ON s."SlotID"=a."SlotID"
         JOIN patient_profiles pp ON pp."PatientID"=a."PatientID"
         JOIN users pu ON pu."UserID"=pp."UserID"
         WHERE a."DoctorID"=$1
           AND a."status" IN ('pending', 'confirmed')
           AND s."start_time" >= NOW()
         ORDER BY s."start_time" ASC
         LIMIT 8`,
        [doctorProfile.DoctorID]
      ),
      db.query(
        `SELECT
            a."AdviceID",
            a."content",
            a."urgency",
            a."is_acknowledged",
            a."acknowledged_at",
            a."created_at",
            pu."name" AS patient_name,
            pu."email" AS patient_email
         FROM patient_advices a
         JOIN patient_profiles pp ON pp."PatientID"=a."PatientID"
         JOIN users pu ON pu."UserID"=pp."UserID"
         WHERE a."DoctorID"=$1
         ORDER BY a."created_at" DESC
         LIMIT 5`,
        [doctorProfile.DoctorID]
      ),
    ]);

    const pending = {
      appointmentRequests: pendingAppointmentRequestsRes.rows[0]?.total || 0,
      matchRequests: pendingMatchRequestsRes.rows[0]?.total || 0,
      adviceReceipts: pendingAdviceReceiptsRes.rows[0]?.total || 0,
    };

    return res.json({
      linkedPatientsTotal: linkedPatientsTotalRes.rows[0]?.total || 0,
      pending,
      upcomingAppointments: upcomingAppointmentsRes.rows,
      recentAdvices: recentAdvicesRes.rows,
    });
  } catch (error) {
    console.error("/api/doctor/dashboard error:", error.message || error);
    return res.status(500).json({ error: "Failed to load doctor dashboard" });
  }
});

// Doctor: list appointments (confirmed/pending) for visibility in schedule UX.
app.get("/api/doctor/appointments", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);
    const appointments = await db.query(
      `SELECT a."AppointmentID", a."status", a."reason", a."created_at",
              s."SlotID", s."start_time", s."end_time",
              pu."name" AS patient_name, pu."email" AS patient_email
       FROM appointments a
       JOIN appointment_slots s ON s."SlotID"=a."SlotID"
       JOIN patient_profiles pp ON pp."PatientID"=a."PatientID"
       JOIN users pu ON pu."UserID"=pp."UserID"
       WHERE a."DoctorID"=$1 AND a."status" IN ('pending', 'confirmed')
       ORDER BY s."start_time" ASC`,
      [doctorProfile.DoctorID]
    );

    return res.json({ appointments: appointments.rows });
  } catch (error) {
    console.error("/api/doctor/appointments error:", error.message || error);
    return res.status(500).json({ error: "Failed to load doctor appointments" });
  }
});

// Patient: list personal appointments (all states for timeline/history).
app.get("/api/patient/appointments", checkJwt, requireRole("patient"), async (req, res) => {
  try {
    const patientProfile = await ensurePatientProfileByUserId(req.currentUser.UserID);
    const appointments = await db.query(
      `SELECT a."AppointmentID", a."status", a."reason", a."created_at",
              s."SlotID", s."start_time", s."end_time",
              du."name" AS doctor_name, du."email" AS doctor_email,
              COALESCE(NULLIF(TRIM(du."name"), ''), NULLIF(TRIM(hp.provider_name), ''), du."email") AS doctor_display_name
       FROM appointments a
       JOIN appointment_slots s ON s."SlotID"=a."SlotID"
       JOIN doctor_profiles dp ON dp."DoctorID"=a."DoctorID"
       JOIN users du ON du."UserID"=dp."UserID"
       LEFT JOIN healthcare_providers hp ON hp."ProviderID"=dp."ProviderID"
       WHERE a."PatientID"=$1
       ORDER BY s."start_time" ASC`,
      [patientProfile.PatientID]
    );

    return res.json({ appointments: appointments.rows });
  } catch (error) {
    console.error("/api/patient/appointments GET error:", error.message || error);
    return res.status(500).json({ error: "Failed to load patient appointments" });
  }
});

// Doctor: load one editable day of slots (tomorrow + 7 day window).
app.get("/api/doctor/appointment-slots", checkJwt, requireRole("doctor"), async (req, res) => {
  try {
    const dateStr = normalizeDateOnlyString(req.query.date);
    const editableWindow = buildEditableDateWindow();
    if (!dateStr || !editableWindow.includes(dateStr)) {
      return res.status(400).json({ error: "date must be within tomorrow and the next 7 days" });
    }

    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);
    await ensureDefaultSlotsForDoctor(doctorProfile.DoctorID);

    const slots = await db.query(
      `SELECT s."SlotID", s."start_time", s."end_time", COALESCE(sa."is_available", TRUE) AS "is_available", s."is_booked",
              a."AppointmentID", a."status" AS appointment_status, a."reason",
              pu."name" AS patient_name, pu."email" AS patient_email
       FROM appointment_slots s
       LEFT JOIN appointment_slot_availability sa ON sa."SlotID"=s."SlotID"
       LEFT JOIN LATERAL (
         SELECT ap."AppointmentID", ap."status", ap."reason", ap."PatientID"
         FROM appointments ap
         WHERE ap."SlotID"=s."SlotID" AND ap."status" IN ('pending', 'confirmed')
         ORDER BY ap."created_at" DESC
         LIMIT 1
       ) a ON TRUE
       LEFT JOIN patient_profiles pp ON pp."PatientID"=a."PatientID"
       LEFT JOIN users pu ON pu."UserID"=pp."UserID"
       WHERE s."DoctorID"=$1 AND DATE(s."start_time")=$2::date
       ORDER BY s."start_time" ASC`,
      [doctorProfile.DoctorID, dateStr]
    );

    return res.json({ date: dateStr, editableWindow, slots: slots.rows });
  } catch (error) {
    console.error("/api/doctor/appointment-slots GET error:", error.message || error);
    return res.status(500).json({ error: "Failed to load appointment slots" });
  }
});

// Doctor: save one day slot availability. Pending/confirmed slots are immutable here.
app.post("/api/doctor/appointment-slots/save-day", checkJwt, requireRole("doctor"), async (req, res) => {
  const dateStr = normalizeDateOnlyString(req.body?.date);
  const updates = Array.isArray(req.body?.slots) ? req.body.slots : [];
  const editableWindow = buildEditableDateWindow();

  if (!dateStr || !editableWindow.includes(dateStr)) {
    return res.status(400).json({ error: "date must be within tomorrow and the next 7 days" });
  }
  if (!updates.length) {
    return res.status(400).json({ error: "slots update payload is required" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);
    await ensureDefaultSlotsForDoctor(doctorProfile.DoctorID);

    const lockedSlotIds = [];
    let savedCount = 0;

    for (const item of updates) {
      const slotId = Number(item?.slotId);
      const isAvailable = Boolean(item?.isAvailable);
      if (!Number.isInteger(slotId) || slotId <= 0) continue;

      const slotRes = await client.query(
        `SELECT "SlotID"
         FROM appointment_slots
         WHERE "SlotID"=$1 AND "DoctorID"=$2 AND DATE("start_time")=$3::date
         FOR UPDATE`,
        [slotId, doctorProfile.DoctorID, dateStr]
      );
      if (!slotRes.rows.length) continue;

      const activeAppt = await client.query(
        `SELECT 1 FROM appointments WHERE "SlotID"=$1 AND "status" IN ('pending', 'confirmed') LIMIT 1`,
        [slotId]
      );
      if (activeAppt.rows.length) {
        lockedSlotIds.push(slotId);
        continue;
      }

      await client.query(
        `INSERT INTO appointment_slot_availability ("SlotID", "is_available", "updated_at")
         VALUES ($1,$2,CURRENT_TIMESTAMP)
         ON CONFLICT ("SlotID") DO UPDATE SET
           "is_available"=EXCLUDED."is_available",
           "updated_at"=CURRENT_TIMESTAMP`,
        [slotId, isAvailable]
      );
      savedCount += 1;
    }

    await writeAuditEvent({
      client,
      req,
      eventType: "appointment.slots_saved_day",
      action: "upsert",
      status: "success",
      targetType: "appointment_slot_availability",
      targetId: dateStr,
      details: {
        doctorId: doctorProfile.DoctorID,
        date: dateStr,
        savedCount,
        lockedSlotIds,
      },
    });

    await client.query("COMMIT");
    return res.json({ success: true, savedCount, lockedSlotIds });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("/api/doctor/appointment-slots/save-day error:", error.message || error);
    await writeAuditEvent({
      req,
      eventType: "appointment.slots_saved_day",
      action: "upsert",
      status: "failed",
      targetType: "appointment_slot_availability",
      targetId: dateStr || null,
      details: {
        error: error.message || String(error),
      },
    });
    return res.status(500).json({ error: "Failed to save slot availability" });
  } finally {
    client.release();
  }
});

// Doctor: confirm/reject a pending appointment request.
app.post("/api/doctor/appointments/:appointmentId/respond", checkJwt, requireRole("doctor"), async (req, res) => {
  const appointmentId = Number(req.params.appointmentId);
  const action = String(req.body?.action || "").toLowerCase();
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ error: "Invalid appointmentId" });
  }
  if (!["confirm", "reject"].includes(action)) {
    return res.status(400).json({ error: "action must be confirm or reject" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const doctorProfile = await ensureDoctorProfileByUser(req.currentUser, req.ip);

    const apptRes = await client.query(
      `SELECT "AppointmentID", "DoctorID", "SlotID", "status"
       FROM appointments
       WHERE "AppointmentID"=$1
       FOR UPDATE`,
      [appointmentId]
    );
    if (!apptRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Appointment not found" });
    }

    const appt = apptRes.rows[0];
    if (appt.DoctorID !== doctorProfile.DoctorID) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Not allowed to respond to this appointment" });
    }
    if (String(appt.status).toLowerCase() !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Appointment already resolved" });
    }

    const nextStatus = action === "confirm" ? "confirmed" : "cancelled";
    await client.query(`UPDATE appointments SET "status"=$1 WHERE "AppointmentID"=$2`, [nextStatus, appointmentId]);

    if (action === "reject") {
      await client.query(`UPDATE appointment_slots SET "is_booked"=FALSE WHERE "SlotID"=$1`, [appt.SlotID]);
    }

    await writeAuditEvent({
      client,
      req,
      eventType: "appointment.request_responded",
      action: "update",
      status: "success",
      targetType: "appointment",
      targetId: appointmentId,
      details: {
        doctorId: doctorProfile.DoctorID,
        action,
        nextStatus,
        slotId: appt.SlotID,
      },
    });

    await client.query("COMMIT");
    return res.json({ success: true, status: nextStatus });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("/api/doctor/appointments/:id/respond error:", error.message || error);
    await writeAuditEvent({
      req,
      eventType: "appointment.request_responded",
      action: "update",
      status: "failed",
      targetType: "appointment",
      targetId: appointmentId,
      details: {
        action,
        error: error.message || String(error),
      },
    });
    return res.status(500).json({ error: "Failed to respond to appointment" });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3000;
initDbArtifacts()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database artifacts:", error.message || error);
    process.exit(1);
  });