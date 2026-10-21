# TODO

Create a Master Spec and Multiple individual SPEC.md files to achieve the following the tasks:

1. Storage Layer

Configure a storage layer using rustfs on docker compose

2. MONITORING

MONITORING THE ENTIRE WORKFLOW - Screen Recording, Console Logs, Actions documented, Errors documented.
Warnings for re-performing events and then success
Failure state for failing events.
Create a schema "debug" with tables browser_automation, workflows, logs, llm_requests
Monitor both - Browser automation workflows and AI calls
Ensure that all these logs, recordings are stored in the storage layer and can be viewed using the /debug/* pages on the frontend

3. Testing Workflows by manually triggering them using /debug/workflows along with their proper inputs.

4. When using the cashfree API, store all details from cashfree api to the database ni both external api calls and vehicle details.

5. Manually tracked documents: Goods Permit and Speed Governer (no expiry) and Purchase Order (optional) and Form 20 (Sale/Purchase Form) are manually tracked documents and they must be uploaded by the user along with their Valid from and Valid till dates.

---

DL

---

Get RC Particulars to get all details over the RC using OTP. Write a sync flow that triggers a OTP and ask user for the OTP, once entered it gets all the RC Particulars details and store it as a PDF and as well as strctuerd schema in the database.

---

Print Green Tax & One-Time Tax

Reprint Receipt => Application No. Wise => Application / Tax / Payment Cart => Online Service / RTO End => Application No. => Solve CAPTCHA => Show Details => Extract details and store in database along with the PDF.

---

Print Fitness Certificate
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

- solve-grecaptcha.ts
- Challan (Maha, Central)

---

Re-fetch, refresh, and store the refresh status in the database

---

Connect GMail and auto-find insurance from GMail
"Auto find CV Motor Insurance"

---

- Cron Jobs and Reminders
- Link GPS
- FASTag History
- TOLL CARD
- DIESEL TRACKER

Mobile App to scrape SMS and report to server and keep them in Sync

- Detect FASTag and Banking Transactions
- If OTP, Skip and not report
- If SPAM, alert to unsubscribe

- FEAT: ADD ADDRESS TO GOOGLE MAPS DETECTION ALGORITHM

---

VIEW UPLOADED DOCUMENTS??

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
