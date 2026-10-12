-- =========================================================
-- FixMate Home Services Platform — MySQL schema
-- Run: mysql -u root -p < sql/schema.sql
-- =========================================================
CREATE DATABASE IF NOT EXISTS fixmate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fixmate;

-- Local dev DB user (change password via env in production).
CREATE USER IF NOT EXISTS 'fixmate'@'localhost' IDENTIFIED BY 'fixmate_pass';
GRANT ALL PRIVILEGES ON fixmate.* TO 'fixmate'@'localhost';
FLUSH PRIVILEGES;

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(190)  NOT NULL UNIQUE,
  phone         VARCHAR(24)   NOT NULL,
  password_hash VARCHAR(100)  NOT NULL,              -- bcrypt hash only, never plaintext
  role          ENUM('customer','admin','technician') NOT NULL DEFAULT 'customer',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(80)  NOT NULL UNIQUE,
  icon        VARCHAR(60)  NOT NULL DEFAULT 'bi-tools',
  description VARCHAR(255) NOT NULL,
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE services (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id  INT UNSIGNED  NOT NULL,
  name         VARCHAR(120)  NOT NULL,
  description  VARCHAR(500)  NOT NULL,
  base_price   DECIMAL(10,2) NOT NULL DEFAULT 0,      -- 0 for quote-based services
  pricing_type ENUM('fixed','quote') NOT NULL DEFAULT 'fixed',
  duration     VARCHAR(40)   NOT NULL,
  skills       VARCHAR(255)  NOT NULL DEFAULT '',
  active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_services_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  INDEX idx_services_category (category_id),
  INDEX idx_services_active (active)
) ENGINE=InnoDB;

CREATE TABLE technicians (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED  NOT NULL,
  category_id   INT UNSIGNED  NOT NULL,
  skills        VARCHAR(255)  NOT NULL,
  experience    VARCHAR(40)   NOT NULL,
  areas         VARCHAR(255)  NOT NULL,               -- comma-separated service areas
  hours         VARCHAR(60)   NOT NULL DEFAULT '09:00 - 18:00',
  status        ENUM('pending','active','suspended') NOT NULL DEFAULT 'pending',
  verification  ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  rating        DECIMAL(3,2)  NOT NULL DEFAULT 0,
  completed_jobs INT UNSIGNED NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tech_user    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tech_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_tech_user (user_id),
  INDEX idx_tech_status (status)
) ENGINE=InnoDB;

CREATE TABLE technician_availability (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  technician_id     INT UNSIGNED NOT NULL UNIQUE,
  working_days      VARCHAR(64)  NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  time_slots        TEXT         NOT NULL,
  break_start       TIME         NULL,
  break_end         TIME         NULL,
  unavailable_dates TEXT         NOT NULL DEFAULT '',  -- comma-separated YYYY-MM-DD
  is_available      TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_avail_tech FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE bookings (
  id             VARCHAR(20)  PRIMARY KEY,             -- e.g. HSP-261010-0001
  user_id        INT UNSIGNED NOT NULL,
  service_id     INT UNSIGNED NOT NULL,
  technician_id  INT UNSIGNED NULL,
  address        VARCHAR(255) NOT NULL,
  city           VARCHAR(80)  NOT NULL,
  date           DATE         NOT NULL,
  time_slot      VARCHAR(20)  NOT NULL,
  notes          VARCHAR(1000) NOT NULL,
  image          TEXT         NULL,                    -- data URL (demo)
  estimated_price DECIMAL(10,2) NOT NULL DEFAULT 0,     -- set by SERVER from services.base_price
  quoted_price   DECIMAL(10,2) NULL,
  final_price    DECIMAL(10,2) NULL,
  payment_status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  status         ENUM('New / Pending','Assigned','Accepted','On the Way','In Progress','Completed','Cancelled','Unable to Complete')
                 NOT NULL DEFAULT 'New / Pending',
  cancel_reason  VARCHAR(500) NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_user  FOREIGN KEY (user_id)       REFERENCES users(id),
  CONSTRAINT fk_booking_service FOREIGN KEY (service_id)  REFERENCES services(id),
  CONSTRAINT fk_booking_tech  FOREIGN KEY (technician_id) REFERENCES technicians(id),
  INDEX idx_bookings_user (user_id),
  INDEX idx_bookings_tech (technician_id),
  INDEX idx_bookings_status_date (status, date)
) ENGINE=InnoDB;

CREATE TABLE booking_status_history (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id   VARCHAR(20)  NOT NULL,
  from_status  VARCHAR(30)  NULL,
  to_status    VARCHAR(30)  NOT NULL,
  actor_user_id INT UNSIGNED NULL,
  actor_label  VARCHAR(120) NOT NULL,
  note         VARCHAR(500) NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hist_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT fk_hist_actor   FOREIGN KEY (actor_user_id) REFERENCES users(id),
  INDEX idx_hist_booking (booking_id)
) ENGINE=InnoDB;

CREATE TABLE payments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id   VARCHAR(20)   NOT NULL UNIQUE,
  amount       DECIMAL(10,2) NOT NULL,
  method       VARCHAR(40)   NOT NULL DEFAULT 'demo (manual)',
  status       ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  paid_at      DATETIME      NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  INDEX idx_payments_status (status)
) ENGINE=InnoDB;

CREATE TABLE reviews (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id VARCHAR(20)  NOT NULL UNIQUE,
  user_id    INT UNSIGNED NOT NULL,
  rating     TINYINT UNSIGNED NOT NULL,
  comment    VARCHAR(1000) NOT NULL,
  moderated  ENUM('visible','hidden','flagged') NOT NULL DEFAULT 'visible',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT fk_review_user    FOREIGN KEY (user_id)    REFERENCES users(id),
  INDEX idx_reviews_moderated (moderated)
) ENGINE=InnoDB;

CREATE TABLE settings (
  id             TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  site_name      VARCHAR(120) NOT NULL DEFAULT 'FixMate Home Services',
  logo_text      VARCHAR(60)  NOT NULL DEFAULT 'FixMate',
  phone          VARCHAR(40)  NOT NULL DEFAULT '+1 (555) 012-3456',
  email          VARCHAR(190) NOT NULL DEFAULT 'support@fixmate.demo',
  address        VARCHAR(255) NOT NULL DEFAULT '42 Market Street, Downtown',
  locations      VARCHAR(255) NOT NULL DEFAULT 'Downtown, Riverside, North Park, Old Town',
  business_hours VARCHAR(120) NOT NULL DEFAULT 'Mon-Sat, 09:00 - 19:00',
  booking_rules  VARCHAR(500) NOT NULL DEFAULT '',
  cancellation_rules VARCHAR(500) NOT NULL DEFAULT '',
  notif_template VARCHAR(500) NOT NULL DEFAULT 'Hi {{customer}}, your booking {{bookingId}} for {{service}} is now "{{status}}".',
  admin_name     VARCHAR(120) NOT NULL DEFAULT 'Site Administrator',
  admin_email    VARCHAR(190) NOT NULL DEFAULT 'admin@fixmate.demo'
) ENGINE=InnoDB;
