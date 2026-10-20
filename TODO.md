# TODO

Re-fetch, refresh, and store the refresh status in the database

Secure the logic behind it using workflow runs poweered by CLI for now.

BROWSER

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

Status => Know your Application Status => Select Vehicle Number radio button => Enter Vehicle Number => Solve for CAPTCHA => Submit => Extract details and store in database.

Reprint Receipt => Application No. Wise => Application / Tax / Payment Cart => Online Service / RTO End => Application No. => Solve CAPTCHA => Show Details => Extract details and store in database along with the PDF.

Print Fitness Certificate

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

- FEAT: ADD ADDRESS TO GOOGLE MAPS DETECTION ALGORITHM

## Triage Features

- Book HSRP Number Plate
- Generate Work Order or Sale Agreement

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

---

Mobile App to scrape SMS and report to server and keep them in Sync

- Detect FASTag and Banking Transactions
- If OTP, Skip and not report
- If SPAM, alert to unsubscribe
