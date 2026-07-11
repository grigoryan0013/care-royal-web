# Care Royal — Data Model (Master Google Sheet)

All data lives in **one Google Sheet per system** (the "master sheet"), one tab
per entity. Every row carries a `tenantId` so multiple agencies share the sheet
without seeing each other's data. The service account (in your Google Workspace)
is the only thing that can read/write it — the agency never touches it.

Column order is authoritative in `functions/lib/tenant.js` (`TABS`). **Only add
new columns at the end** so existing rows stay valid.

| Tab | Columns |
|-----|---------|
| **Tenants** | tenantId, name, slug, plan, status, stripeAccountId, createdAt |
| **Users** | userId, tenantId, email, passHash, role, name, phone, status, createdAt |
| **Households** | householdId, tenantId, primaryUserId, name, address, city, zip, createdAt |
| **HouseholdMembers** | id, tenantId, householdId, userId, memberRole |
| **Recipients** | recipientId, tenantId, householdId, name, type, dob, address, conditions, notes, photoUrl, createdAt |
| **Services** | serviceId, tenantId, category, name, profileType, pricingModel, rate, credential, durationMin, active |
| **CaregiverProfiles** | userId, tenantId, credentials, rate, bio, status |
| **Bookings** | bookingId, tenantId, householdId, recipientId, serviceId, requestedBy, status, start, end, recurrence, caregiverId, notes, createdAt |
| **Shifts** | shiftId, tenantId, bookingId, caregiverId, start, end, status, clockIn, clockOut, gpsIn, gpsOut, notes |
| **Invoices** | invoiceId, tenantId, householdId, bookingId, amount, status, stripeId, createdAt |
| **Documents** | docId, tenantId, subjectType, subjectId, template, driveFileId, status, signedBy, signedAt |
| **Leads** | leadId, tenantId, name, email, phone, address, city, zip, stage, source, notes, createdAt |

### Roles (Users.role)
- `agency_admin` — owner/full access (created at bootstrap or by an admin)
- `agency_coord` — coordinator (agency staff)
- `caregiver` — self-serve signup allowed
- `family` — self-serve signup allowed

### Member roles (HouseholdMembers.memberRole)
- `manager` — can book, edit schedule, pay, sign
- `viewer` — can view schedule and updates only

### Recipient types (Recipients.type)
- `person` | `pet` | `home`

### The tabs are created automatically
`POST /api/auth {action:"bootstrap"}` calls `ensureAllTabs()`, which creates every
tab with its header row if missing. You never have to build the sheet by hand.
