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

Dark Mode

Secure DB and infrastructure? Cloudflare Infra

Re-fetch, refresh, and store the refresh status in the database

Secure the logic behind it using workflow runs poweered by CLI for now.

---

CASHFREE

API_EXPRESS

BROWSER

---

Get Fitness Certificate Success APPL. NUM.

Vehicle RC API @Rs. 3 at Cashfree
GET VIN DETAILS / rc particulars
- CHASSIS NO.??
- ENGINE NO.??

PRINT Slot Booking Letter
- Chassis No.
- Appointment No.
- Permit No. & Validity
- Fitness No. & Validity
- Tax No. & Validity
- Speed Governer No. & Speed Governer Manf.
- VIN Details??

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

Know Your Vehicle Details
RC

Print PUCC

Green Tax
One Time Tax

SPEED GOVERNER??
DL??
PERMIT??
GET INSURANCE FROM EMAIL!!
HSRP??
VLTD??

Purchase Order??
RTO Form 20??

- FASTag History
- GPS
- TOLL CARD
- DIESEL TRACKER

- Challan (Maha, Central)

---

VIEW UPLOADED DOCUMENTS??

---

- Routes configure
- CRUD Interface
- Link everything (Relations)
- Cron Jobs and Reminders

1. CRUD Vehicles and get RTO History.
2. CRUD Driving Licenses
3. Link GPS and FASTag and Diesel Card
4. Settings with preferences (Group Invitation Link to Join)
5. Group Command: @Vahan MH 01 CR 7464 (Share link that is valid for 24 hours)
6. Reminders with WHATSAPP = EVERYDAY-UNTIL-REFRESHED-D0 / D-1 / D-3 / D-7 / D-14 (Everyday 8:30 AM)

- Link GPS
- Manage all kinds of documents
- Manage appointments for Permit and Fitness
- Refresh FASTag History

- WhatsApp OTP Authentication
- WhatsApp OTP Auth & Groups & Templates
- Cron Jobs
- Workflow Management

- Book HSRP Number Plate
- FEAT: ADD ADDRESS TO GOOGLE MAPS DETECTION ALGORITHM
- Generate Work Order or Sale Agreement

- Battle Tested Integrations
  - Tables
  - Forms

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
