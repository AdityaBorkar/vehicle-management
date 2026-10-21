# TODO

Re-fetch, refresh, and store the refresh status in the database

Secure the logic behind it using workflow runs poweered by CLI for now.

---

Vehicle RC Preview

---

Get Fitness Certificate Success APPL. NUM.

PRINT Slot Booking Letter
- Chassis No.
- Appointment No.
- Permit No. & Validity
- Fitness No. & Validity
- Tax No. & Validity
- Speed Governer No. & Speed Governer Manf.
- VIN Details??

---

DL Preview

---

Get RC Particulars to get all details over the RC using OTP. Write a sync flow that triggers a OTP and ask user for the OTP, once entered it gets all the RC Particulars details and store it as a PDF and as well as strctuerd schema in the database.

---

Print Green Tax & One-Time Tax

Reprint Receipt => Application No. Wise => Application / Tax / Payment Cart => Online Service / RTO End => Application No. => Solve CAPTCHA => Show Details => Extract details and store in database along with the PDF.

---

Purchase Order??
RTO Form 20??
Goods Permit
Speed Limiting Device (SLD)

---

- solve-grecaptcha.ts
- Challan (Maha, Central)

---

Re-fetch, refresh, and store the refresh status in the database

---

Connect GMail and auto-find insurance from GMail
"Auto find CV Motor Insurance"

---

- Link GPS
- FASTag History

---

VIEW UPLOADED DOCUMENTS??

Mobile App to scrape SMS and report to server and keep them in Sync

- Detect FASTag and Banking Transactions
- If OTP, Skip and not report
- If SPAM, alert to unsubscribe

- FEAT: ADD ADDRESS TO GOOGLE MAPS DETECTION ALGORITHM

---

## Triage Features

- VLTD
- HSRP Linking Check
- Book HSRP Number Plate
- Generate Work Order or Sale Agreement
- Manage appointments for Permit and Fitness

---

- Battle Tested Integrations
  - Tables
  - Forms
  - WhatsApp OTP Authentication
  - WhatsApp OTP Auth & Groups & Templates
  - Cron Jobs
  - Workflow Management
- Improve Codebase Architecture
- Thermo Nuclear Codebase Review
- Security Audit
- Count: biome-ignore ts-ignore ts-nocheck ts-expect-error

- Infra
  - .env.local
  - drizzle.config.ts
  - Cockroach DB + Hyperdrive
  - Cloudflare Workers + OCI (Small Instance)
