# PocketBase Collections Verification Report

**Date:** 2026-05-08
**Status:** ✅ COLLECTIONS VERIFICATION READY

---

## CRITICAL NOTICE

⚠️ **This report documents the EXPECTED collections structure based on the codebase analysis.**

**To complete this verification, you must:**

1. **Start PocketBase:**
   ```bash
   cd apps/pocketbase
   ./pocketbase serve
   ```

2. **Access PocketBase Admin Panel:**
   - URL: http://localhost:8090/_/
   - Email: admin@example.com
   - Password: admin123456

3. **Verify Collections:**
   - Go to Collections tab
   - Check each collection listed below
   - Verify schema fields match expected structure
   - Verify access rules are configured

---

## 1. CORE COLLECTIONS

### ✅ users
**Purpose:** User accounts and authentication

**Expected Fields:**
- id (string, primary key)
- email (string, unique, required)
- password (string, hashed)
- name (string)
- avatar (string, file)
- emailVerified (boolean, default: false)
- mfaEnabled (boolean, default: false)
- otpEnabled (boolean, default: false)
- activeSessions (array of objects)
- lastLoginDevice (string)
- lastLoginIp (string)
- backupCodes (string, encrypted)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] email field is unique
- [ ] password field is hashed
- [ ] Access rules configured
- [ ] Can create/read/update records

---

### ✅ auditLogs
**Purpose:** Security event logging

**Expected Fields:**
- id (string, primary key)
- userId (string, foreign key to users)
- eventType (string, required)
- description (string)
- ipAddress (string)
- userAgent (string)
- status (string)
- timestamp (datetime, required)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] userId field is foreign key
- [ ] Can create/read records

---

### ✅ loginAttempts
**Purpose:** Track failed login attempts for account lockout

**Expected Fields:**
- id (string, primary key)
- email (string, required)
- ipAddress (string, required)
- failedAttempts (number, default: 0)
- lockedUntil (datetime)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/update records

---

### ✅ passwordResetTokens
**Purpose:** Store password reset tokens

**Expected Fields:**
- id (string, primary key)
- userId (string, foreign key to users, required)
- email (string, required)
- resetToken (string, unique, required)
- expiresAt (datetime, required)
- isUsed (boolean, default: false)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] resetToken field is unique
- [ ] Can create/update records

---

### ✅ mfaSessions
**Purpose:** Store MFA session data

**Expected Fields:**
- id (string, primary key)
- userId (string, foreign key to users, required)
- email (string, required)
- mfaId (string, unique, required)
- encryptedCode (string, required)
- expiresAt (datetime, required)
- verified (boolean, default: false)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] mfaId field is unique
- [ ] Can create/update records

---

### ✅ securityAlerts
**Purpose:** Track suspicious activity alerts

**Expected Fields:**
- id (string, primary key)
- userId (string, foreign key to users, required)
- alertType (string, required)
- severity (string)
- description (string)
- ipAddress (string)
- userAgent (string)
- read (boolean, default: false)
- createdAt (datetime)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

## 2. PRODUCT & MARKETPLACE COLLECTIONS

### ✅ products
**Purpose:** Product catalog

**Expected Fields:**
- id (string, primary key)
- name (string, required)
- description (string)
- price (number, required)
- category (string)
- sku (string, unique)
- images (array of files)
- quantity (number, default: 0)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ shop_products
**Purpose:** Shop product listings

**Expected Fields:**
- id (string, primary key)
- title (string, required)
- description (string)
- price (number, required)
- images (array of files)
- category (string)
- quantity (number, default: 0)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ marketplace_listings
**Purpose:** Marketplace product listings

**Expected Fields:**
- id (string, primary key)
- title (string, required)
- description (string)
- price (number, required)
- images (array of files)
- category (string)
- quantity (number, default: 0)
- sellerId (string, foreign key to users)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ cardListings
**Purpose:** Trading card listings

**Expected Fields:**
- id (string, primary key)
- cardId (string, foreign key to cards, required)
- sellerId (string, foreign key to users, required)
- price (number, required)
- quantity (number, default: 1)
- condition (string)
- grade (string)
- images (array of files)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

## 3. TRADING CARD COLLECTIONS

### ✅ cards
**Purpose:** Trading card database

**Expected Fields:**
- id (string, primary key)
- name (string, required)
- collection (string, required)
- set (string)
- number (string)
- rarity (string)
- image (file)
- description (string)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ officialCatalog
**Purpose:** Official card catalog

**Expected Fields:**
- id (string, primary key)
- cardId (string, foreign key to cards, required)
- officialPrice (number)
- rarity (string)
- condition (string)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ grading_guides
**Purpose:** Card grading guides

**Expected Fields:**
- id (string, primary key)
- title (string, required)
- description (string)
- gradingScale (string)
- images (array of files)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

## 4. TRADING & TRANSACTION COLLECTIONS

### ✅ tradeRequests
**Purpose:** User-to-user trade requests

**Expected Fields:**
- id (string, primary key)
- initiatorId (string, foreign key to users, required)
- recipientId (string, foreign key to users, required)
- initiatorCards (array of strings, foreign keys to cards)
- recipientCards (array of strings, foreign keys to cards)
- status (string, default: 'pending')
- message (string)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ transactions
**Purpose:** Payment and trade transactions

**Expected Fields:**
- id (string, primary key)
- buyerId (string, foreign key to users, required)
- sellerId (string, foreign key to users, required)
- amount (number, required)
- type (string, required)
- status (string, default: 'pending')
- stripeSessionId (string)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

## 5. CONTENT COLLECTIONS

### ✅ community_content
**Purpose:** Community posts and discussions

**Expected Fields:**
- id (string, primary key)
- title (string, required)
- content (string, required)
- authorId (string, foreign key to users, required)
- category (string)
- tags (array of strings)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ blog_articles
**Purpose:** Blog articles

**Expected Fields:**
- id (string, primary key)
- title (string, required)
- content (string, required)
- authorId (string, foreign key to users, required)
- publishedDate (datetime)
- category (string)
- tags (array of strings)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ articles
**Purpose:** General articles

**Expected Fields:**
- id (string, primary key)
- title (string, required)
- content (string, required)
- authorId (string, foreign key to users)
- category (string)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

## 6. MARKETPLACE STRUCTURE COLLECTIONS

### ✅ categories
**Purpose:** Product categories

**Expected Fields:**
- id (string, primary key)
- name (string, required, unique)
- description (string)
- icon (file)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ subcategories
**Purpose:** Product subcategories

**Expected Fields:**
- id (string, primary key)
- name (string, required)
- categoryId (string, foreign key to categories, required)
- description (string)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ retailers
**Purpose:** Retail partners

**Expected Fields:**
- id (string, primary key)
- name (string, required, unique)
- description (string)
- logo (file)
- website (string)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

## 7. FEATURED & EVENTS COLLECTIONS

### ✅ featuredCards
**Purpose:** Featured trading cards

**Expected Fields:**
- id (string, primary key)
- cardId (string, foreign key to cards, required)
- position (number)
- startDate (datetime)
- endDate (datetime)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ featuredSellers
**Purpose:** Featured sellers

**Expected Fields:**
- id (string, primary key)
- sellerId (string, foreign key to users, required)
- position (number)
- startDate (datetime)
- endDate (datetime)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ events
**Purpose:** Marketplace events

**Expected Fields:**
- id (string, primary key)
- title (string, required)
- description (string)
- startDate (datetime, required)
- endDate (datetime, required)
- location (string)
- image (file)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

## 8. UTILITY COLLECTIONS

### ✅ csvFiles
**Purpose:** Store uploaded CSV files

**Expected Fields:**
- id (string, primary key)
- filename (string, required)
- file (file, required)
- collection (string)
- status (string, default: 'pending')
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ importHistory
**Purpose:** Track data imports

**Expected Fields:**
- id (string, primary key)
- filename (string, required)
- collection (string, required)
- recordsImported (number, default: 0)
- recordsFailed (number, default: 0)
- status (string, default: 'pending')
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ market_data
**Purpose:** Store eBay market data

**Expected Fields:**
- id (string, primary key)
- cardName (string, required)
- collection (string)
- avgPrice (number)
- highestSale (number)
- lowestSale (number)
- salesCount (number)
- lastUpdated (datetime)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ media
**Purpose:** Store media files

**Expected Fields:**
- id (string, primary key)
- filename (string, required)
- file (file, required)
- type (string)
- uploadedBy (string, foreign key to users)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

## 9. ADDITIONAL COLLECTIONS

### ✅ messages
**Purpose:** User messages

**Expected Fields:**
- id (string, primary key)
- senderId (string, foreign key to users, required)
- recipientId (string, foreign key to users, required)
- content (string, required)
- read (boolean, default: false)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ reviews
**Purpose:** Product and seller reviews

**Expected Fields:**
- id (string, primary key)
- reviewerId (string, foreign key to users, required)
- targetId (string, required)
- targetType (string, required)
- rating (number, required)
- comment (string)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ accountContent
**Purpose:** User account content

**Expected Fields:**
- id (string, primary key)
- userId (string, foreign key to users, required)
- content (string)
- type (string)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ marketplaceStructure
**Purpose:** Marketplace configuration

**Expected Fields:**
- id (string, primary key)
- key (string, required, unique)
- value (string)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

### ✅ google_verification
**Purpose:** Google verification files

**Expected Fields:**
- id (string, primary key)
- filename (string, required, unique)
- content (string, required)
- created (datetime)
- updated (datetime)

**Verification Checklist:**
- [ ] Collection exists
- [ ] All fields present
- [ ] Can create/read/update records

---

## 10. VERIFICATION CHECKLIST

### ✅ Collection Verification Steps

**For Each Collection:**

1. **Existence Check**
   - [ ] Collection appears in PocketBase Collections list
   - [ ] Collection name matches expected name

2. **Schema Verification**
   - [ ] All expected fields present
   - [ ] Field types match expected types
   - [ ] Required fields marked as required
   - [ ] Unique fields marked as unique
   - [ ] Foreign keys properly configured

3. **Access Rules**
   - [ ] Create rule configured
   - [ ] Read rule configured
   - [ ] Update rule configured
   - [ ] Delete rule configured

4. **File Fields (if applicable)**
   - [ ] maxSize configured
   - [ ] mimeTypes configured
   - [ ] thumbs configured (if needed)

5. **CRUD Operations**
   - [ ] Can create records
   - [ ] Can read records
   - [ ] Can update records
   - [ ] Can delete records

---

## 11. SUMMARY

### ✅ COLLECTIONS VERIFICATION READY

**Total Collections:** 30+

**Collection Categories:**
- Core: 6 collections
- Products & Marketplace: 4 collections
- Trading Cards: 3 collections
- Trading & Transactions: 2 collections
- Content: 3 collections
- Marketplace Structure: 3 collections
- Featured & Events: 3 collections
- Utility: 4 collections
- Additional: 5 collections

**Status:** ✅ READY FOR VERIFICATION

---

## 12. NEXT STEPS

1. **Start PocketBase:**
   ```bash
   cd apps/pocketbase
   ./pocketbase serve
   ```

2. **Access Admin Panel:**
   - URL: http://localhost:8090/_/
   - Email: admin@example.com
   - Password: admin123456

3. **Verify Collections:**
   - Go to Collections tab
   - Check each collection
   - Verify schema matches
   - Verify access rules

4. **Test CRUD Operations:**
   - Create test records
   - Read records
   - Update records
   - Delete records

5. **Report Results:**
   - Document any missing collections
   - Document any schema mismatches
   - Document any access rule issues

---

**Report Generated:** 2026-05-08
**Status:** ✅ READY FOR VERIFICATION
