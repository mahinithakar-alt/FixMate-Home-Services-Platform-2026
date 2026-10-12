-- =========================================================
-- FixMate — catalog seed data (NO passwords here;
-- users are created via scripts/create-admin.js and
-- scripts/seed-demo-users.js with bcrypt hashes)
-- Run: mysql -u root -p < sql/seed.sql
-- =========================================================
USE fixmate;

INSERT INTO categories (name, icon, description, active) VALUES
  ('Carpenter','bi-hammer','Furniture repair, fitting, doors and woodwork.',1),
  ('Car Mechanic','bi-wrench-adjustable','Vehicle inspection, repair and breakdown assistance.',1),
  ('Car Washing','bi-droplet','Doorstep or service-location car cleaning.',1),
  ('Plumber','bi-droplet-half','Taps, pipes, drainage and water leakage repairs.',1),
  ('Electrician','bi-lightning-charge','Wiring, switches, fans, lights and electrical faults.',1),
  ('House Worker','bi-house-heart','Cleaning and other approved household tasks.',1),
  ('AC Technician','bi-thermometer-snow','AC installation, servicing and repair.',1),
  ('Mobile Technician','bi-phone','Mobile phone diagnostics and repair.',0);

INSERT INTO services (category_id, name, description, base_price, pricing_type, duration, skills, active) VALUES
  (1,'Furniture Repair','Fix broken chairs, tables, cabinets and wooden furniture on site.',35.00,'fixed','1-2 hours','Woodwork,Furniture assembly',1),
  (1,'Door & Lock Fitting','Install or replace interior doors, handles and locks.',50.00,'fixed','2-3 hours','Doors,Locks',1),
  (2,'Car Inspection','Full 40-point vehicle condition inspection before purchase or trip.',0.00,'quote','1-2 hours','Diagnostics,Engines',1),
  (2,'Battery Jump-start & Replacement','On-site battery testing, jump-start or replacement.',25.00,'fixed','30-60 minutes','Electrical,Batteries',1),
  (3,'Doorstep Car Wash','Exterior wash and interior vacuum at your home.',20.00,'fixed','45-60 minutes','Detailing',1),
  (3,'Full Detailing','Deep cleaning, wax and polish inside and out.',60.00,'fixed','2-3 hours','Detailing,Polish',1),
  (4,'Leak Repair','Fix leaking taps, pipes and visible drainage leaks.',30.00,'fixed','1 hour','Pipes,Fittings',1),
  (4,'Bathroom Plumbing Overhaul','Diagnose and rework bathroom plumbing; quoted after inspection.',0.00,'quote','2-4 hours','Pipes,Tiling basics',1),
  (5,'Switch & Socket Repair','Repair or replace faulty switches, sockets and wiring points.',25.00,'fixed','1 hour','Wiring',1),
  (5,'Ceiling Fan Installation','Install or replace ceiling fans, including mounting and balancing.',40.00,'fixed','1-2 hours','Wiring,Mounting',1),
  (6,'Home Deep Cleaning','Full-home deep cleaning covering rooms, kitchen and bathrooms.',70.00,'fixed','3-5 hours','Cleaning',1),
  (6,'Kitchen Cleaning','Degrease and deep-clean kitchen counters, cabinets and appliances.',45.00,'fixed','2-3 hours','Cleaning',1),
  (7,'AC Service & Cleaning','Filter, coil and drainage cleaning for split or window AC units.',55.00,'fixed','1-2 hours','HVAC',1),
  (7,'AC Installation','New split-AC installation incl. bracket and piping; quoted after survey.',0.00,'quote','3-4 hours','HVAC,Installation',1),
  (8,'Phone Screen Repair','Cracked screen diagnosis and replacement for major brands.',0.00,'quote','1-2 hours','Micro-soldering',0),
  (8,'Battery Replacement','Mobile battery replacement with genuine parts.',30.00,'fixed','45 minutes','Battery swap',0);

INSERT INTO settings (id) VALUES (1);
