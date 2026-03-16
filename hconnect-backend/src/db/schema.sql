-- 创建 ENUM 类型
CREATE TYPE role_enum AS ENUM('doctor', 'patient');
CREATE TYPE status_enum AS ENUM('active', 'inactive');
CREATE TYPE appointment_status_enum AS ENUM('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE source_enum AS ENUM('manual', 'device', 'doctor');
CREATE TYPE match_request_status_enum AS ENUM('pending', 'accepted', 'rejected', 'cancelled');

-- Users 表 (核心用户表)
CREATE TABLE users (
  "UserID" SERIAL PRIMARY KEY,
  "role" role_enum NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "phone" VARCHAR(20),
  "country" VARCHAR(2),
  "auth0_id" VARCHAR(255) UNIQUE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Healthcare_Providers 表 (预注册的医疗人员)
CREATE TABLE healthcare_providers (
  "ProviderID" SERIAL PRIMARY KEY,
  "country" VARCHAR(2) NOT NULL,
  "phone_number" VARCHAR(20) NOT NULL,
  "provider_name" VARCHAR(255) NOT NULL,
  "institution" VARCHAR(255),
  "specialty" VARCHAR(100),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("country", "phone_number")
);

-- Doctor_Profiles 表
CREATE TABLE doctor_profiles (
  "DoctorID" SERIAL PRIMARY KEY,
  "UserID" INT UNIQUE NOT NULL REFERENCES users("UserID") ON DELETE CASCADE,
  "ProviderID" INT NOT NULL REFERENCES healthcare_providers("ProviderID") ON DELETE RESTRICT,
  "registration_ip" VARCHAR(50),
  "specialty" VARCHAR(100),
  "hospital" VARCHAR(255),
  "bio" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("ProviderID")
);

-- Patient_Profiles 表
CREATE TABLE patient_profiles (
  "PatientID" SERIAL PRIMARY KEY,
  "UserID" INT UNIQUE NOT NULL REFERENCES users("UserID") ON DELETE CASCADE,
  "height_cm" DECIMAL(5,2),
  "weight_kg" DECIMAL(5,2),
  "blood_type" VARCHAR(10),
  "address" TEXT,
  "emergency_contact" VARCHAR(255),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctor_Patient_Relations table (doctor-patient relations)
CREATE TABLE doctor_patient_relations (
  "RelationID" SERIAL PRIMARY KEY,
  "DoctorID" INT NOT NULL REFERENCES doctor_profiles("DoctorID") ON DELETE CASCADE,
  "PatientID" INT NOT NULL REFERENCES patient_profiles("PatientID") ON DELETE CASCADE,
  "start_date" DATE NOT NULL,
  "status" status_enum DEFAULT 'active',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("DoctorID", "PatientID")
);

-- Doctor_Patient_Match_Requests table (pending requests before relation is accepted)
CREATE TABLE doctor_patient_match_requests (
  "RequestID" SERIAL PRIMARY KEY,
  "DoctorID" INT NOT NULL REFERENCES doctor_profiles("DoctorID") ON DELETE CASCADE,
  "PatientID" INT NOT NULL REFERENCES patient_profiles("PatientID") ON DELETE CASCADE,
  "status" match_request_status_enum NOT NULL DEFAULT 'pending',
  "message" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "responded_at" TIMESTAMP
);

CREATE UNIQUE INDEX uniq_pending_match_request
ON doctor_patient_match_requests ("DoctorID", "PatientID")
WHERE "status" = 'pending';

-- Appointment_Slots table (doctor appointment slots)
CREATE TABLE appointment_slots (
  "SlotID" SERIAL PRIMARY KEY,
  "DoctorID" INT NOT NULL REFERENCES doctor_profiles("DoctorID") ON DELETE CASCADE,
  "start_time" TIMESTAMP NOT NULL,
  "end_time" TIMESTAMP NOT NULL,
  "is_booked" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments 表 (预约记录)
CREATE TABLE appointments (
  "AppointmentID" SERIAL PRIMARY KEY,
  "DoctorID" INT NOT NULL REFERENCES doctor_profiles("DoctorID") ON DELETE CASCADE,
  "PatientID" INT NOT NULL REFERENCES patient_profiles("PatientID") ON DELETE CASCADE,
  "SlotID" INT NOT NULL REFERENCES appointment_slots("SlotID") ON DELETE CASCADE,
  "status" appointment_status_enum DEFAULT 'pending',
  "reason" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patient_Advices table (doctor advices for linked patients)
CREATE TABLE patient_advices (
  "AdviceID" SERIAL PRIMARY KEY,
  "DoctorID" INT NOT NULL REFERENCES doctor_profiles("DoctorID") ON DELETE CASCADE,
  "PatientID" INT NOT NULL REFERENCES patient_profiles("PatientID") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "urgency" VARCHAR(20) NOT NULL CHECK ("urgency" IN ('urgent', 'normal', 'low')),
  "is_acknowledged" BOOLEAN NOT NULL DEFAULT FALSE,
  "acknowledged_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index to optimize doctor-patient advice history queries ordered by created_at
CREATE INDEX idx_patient_advices_doctor_patient_created_at_desc
  ON patient_advices("DoctorID", "PatientID", "created_at" DESC);

-- Health_Metric_Types 表 (健康指标类型)
CREATE TABLE health_metric_types (
  "MetricTypeID" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "unit" VARCHAR(50),
  "min_value" DECIMAL(10,2),
  "max_value" DECIMAL(10,2),
  "description" TEXT
);

-- Seed required metric types for patient daily report form.
INSERT INTO health_metric_types ("name", "unit", "min_value", "max_value", "description")
SELECT 'Blood Pressure Systolic', 'mmHg', 70, 250, 'Systolic blood pressure reading'
WHERE NOT EXISTS (
  SELECT 1 FROM health_metric_types WHERE LOWER("name") = LOWER('Blood Pressure Systolic')
);

INSERT INTO health_metric_types ("name", "unit", "min_value", "max_value", "description")
SELECT 'Blood Pressure Diastolic', 'mmHg', 40, 150, 'Diastolic blood pressure reading'
WHERE NOT EXISTS (
  SELECT 1 FROM health_metric_types WHERE LOWER("name") = LOWER('Blood Pressure Diastolic')
);

INSERT INTO health_metric_types ("name", "unit", "min_value", "max_value", "description")
SELECT 'Weight', 'kg', 20, 350, 'Body weight'
WHERE NOT EXISTS (
  SELECT 1 FROM health_metric_types WHERE LOWER("name") = LOWER('Weight')
);

INSERT INTO health_metric_types ("name", "unit", "min_value", "max_value", "description")
SELECT 'Sleep Duration', 'hours', 0, 24, 'Total sleep duration in hours'
WHERE NOT EXISTS (
  SELECT 1 FROM health_metric_types WHERE LOWER("name") = LOWER('Sleep Duration')
);

INSERT INTO health_metric_types ("name", "unit", "min_value", "max_value", "description")
SELECT 'Sleep Quality', 'score', 1, 10, 'Self-rated sleep quality score'
WHERE NOT EXISTS (
  SELECT 1 FROM health_metric_types WHERE LOWER("name") = LOWER('Sleep Quality')
);

INSERT INTO health_metric_types ("name", "unit", "min_value", "max_value", "description")
SELECT 'Pain Level', 'score', 0, 10, 'Self-rated pain level score'
WHERE NOT EXISTS (
  SELECT 1 FROM health_metric_types WHERE LOWER("name") = LOWER('Pain Level')
);

-- Patient_Metric_Records table (patient health metric records)
CREATE TABLE patient_metric_records (
  "RecordID" SERIAL PRIMARY KEY,
  "PatientID" INT NOT NULL REFERENCES patient_profiles("PatientID") ON DELETE CASCADE,
  "MetricTypeID" INT NOT NULL REFERENCES health_metric_types("MetricTypeID") ON DELETE CASCADE,
  "value" DECIMAL(10,2) NOT NULL,
  "recorded_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "source" source_enum DEFAULT 'manual',
  "notes" TEXT
);

-- 创建索引以提高查询性能
CREATE INDEX idx_users_email ON users("email");
CREATE INDEX idx_users_auth0_id ON users("auth0_id");
CREATE INDEX idx_doctor_profiles_userid ON doctor_profiles("UserID");
CREATE INDEX idx_patient_profiles_userid ON patient_profiles("UserID");
CREATE INDEX idx_doctor_patient_relations ON doctor_patient_relations("DoctorID", "PatientID");
CREATE INDEX idx_appointments_doctorid ON appointments("DoctorID");
CREATE INDEX idx_appointments_patientid ON appointments("PatientID");
CREATE INDEX idx_patient_metric_records ON patient_metric_records("PatientID", "recorded_at");

-- Additional performance indexes for current high-frequency API queries
CREATE INDEX idx_match_requests_doctor_status_created ON doctor_patient_match_requests("DoctorID", "status", "created_at" DESC);
CREATE INDEX idx_match_requests_patient_status_created ON doctor_patient_match_requests("PatientID", "status", "created_at" DESC);
CREATE INDEX idx_appointments_doctor_status_created ON appointments("DoctorID", "status", "created_at" DESC);
CREATE INDEX idx_appointments_patient_created ON appointments("PatientID", "created_at" DESC);
CREATE INDEX idx_appointments_slot_status ON appointments("SlotID", "status");
CREATE INDEX idx_appointment_slots_doctor_start_time ON appointment_slots("DoctorID", "start_time");
CREATE INDEX idx_relations_doctor_status_created ON doctor_patient_relations("DoctorID", "status", "created_at" DESC);
CREATE INDEX idx_patient_advices_doctor_created ON patient_advices("DoctorID", "created_at" DESC);
CREATE INDEX idx_patient_advices_doctor_ack_created ON patient_advices("DoctorID", "is_acknowledged", "created_at" DESC);
CREATE INDEX idx_patient_advices_patient_created ON patient_advices("PatientID", "created_at" DESC);
CREATE INDEX idx_patient_advices_pending ON patient_advices("PatientID", "is_acknowledged", "created_at" DESC);

-- Enforce one active appointment per slot.
CREATE UNIQUE INDEX uniq_active_appointment_per_slot
ON appointments("SlotID")
WHERE "status" IN ('pending', 'confirmed');