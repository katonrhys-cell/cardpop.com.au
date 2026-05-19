# Authentication Endpoints Reference

**Last Updated:** 2026-05-08  
**Status:** ✅ PRODUCTION READY

---

## Base URL

```
http://localhost:3001/hcgi/api
```

---

## Endpoints

### 1. Login

**POST** `/auth/login/authenticate`

Authenticate user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass2026!@#",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "pb_auth_token_...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "avatar": "avatar_url"
  },
  "sessionId": "session_..."
}
```

**Error Responses:**
- 400 Bad Request: Missing required fields
- 401 Unauthorized: Invalid credentials
- 429 Too Many Requests: Account locked

---

### 2. Check Login Attempts

**POST** `/auth/login/attempt`

Check if account is locked due to failed login attempts.

**Request Body:**
```json
{
  "email": "user@example.com",
  "ipAddress": "192.168.1.100"
}
```

**Response (200 OK):**
```json
{
  "allowed": true
}
```

**Response (429 Too Many Requests):**
```json
{
  "error": "Account temporarily locked due to too many failed login attempts",
  "lockedUntil": "2026-05-08T15:30:00.000Z"
}
```

---

### 3. Record Failed Login Attempt

**POST** `/auth/login/record-failure`

Record a failed login attempt (called by frontend after failed login).

**Request Body:**
```json
{
  "email": "user@example.com",
  "ipAddress": "192.168.1.100"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### 4. Clear Failed Login Attempts

**POST** `/auth/login/record-success`

Clear failed login attempts after successful login.

**Request Body:**
```json
{
  "email": "user@example.com",
  "ipAddress": "192.168.1.100"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### 5. Request Password Reset

**POST** `/auth/password/reset/request`

Request a password reset token. Email will be sent via PocketBase hook.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Note:** Same response for existing and non-existing users (prevents user enumeration)

---

### 6. Verify Reset Token

**POST** `/auth/password/reset/verify`

Verify that a reset token is valid and not expired.

**Request Body:**
```json
{
  "resetToken": "reset_1715168400000_abc123xyz"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Token is valid",
  "userId": "user_id"
}
```

**Error Responses:**
- 400 Bad Request: Missing token
- 500 Internal Server Error: Invalid, expired, or used token

---

### 7. Complete Password Reset

**POST** `/auth/password/reset/complete`

Complete password reset with new password.

**Request Body:**
```json
{
  "resetToken": "reset_1715168400000_abc123xyz",
  "newPassword": "NewSecurePass2026!@#"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully. Please log in with your new password."
}
```

**Error Responses:**
- 400 Bad Request: Missing fields or weak password
- 500 Internal Server Error: Invalid, expired, or used token

---

### 8. Validate Password Strength

**POST** `/auth/password/validate`

Validate password strength without making any changes.

**Request Body:**
```json
{
  "password": "SecurePass2026!@#"
}
```

**Response (200 OK):**
```json
{
  "isStrong": true,
  "strengthScore": 5,
  "missing": []
}
```

**Response (200 OK - Weak Password):**
```json
{
  "isStrong": false,
  "strengthScore": 2,
  "missing": ["uppercase", "numbers", "specialChars", "length"]
}
```

---

### 9. Change Password (Authenticated)

**POST** `/auth/password/change`

Change password for authenticated user. Requires valid auth token.

**Headers:**
```
Authorization: Bearer pb_auth_token_...
```

**Request Body:**
```json
{
  "currentPassword": "SecurePass2026!@#",
  "newPassword": "NewSecurePass2026!@#"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**
- 400 Bad Request: Missing fields or weak password
- 401 Unauthorized: Invalid auth token
- 500 Internal Server Error: Incorrect current password

---

## Password Requirements

All passwords must meet ALL of the following requirements:

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)

**Valid Examples:**
- `SecurePass2026!@#`
- `MyPassword123!`
- `Test@Pass2024`

**Invalid Examples:**
- `password` (no uppercase, number, special char)
- `Password123` (no special char)
- `Pass!` (too short)

---

## Error Codes

| Code | Message | Cause |
|------|---------|-------|
| 400 | Email is required | Missing email field |
| 400 | Password is required | Missing password field |
| 400 | IP address is required | Missing IP address |
| 400 | Reset token is required | Missing reset token |
| 400 | New password is required | Missing new password |
| 400 | Password does not meet strength requirements | Weak password |
| 401 | Invalid email or password | Wrong credentials |
| 401 | Invalid token | Invalid auth token |
| 401 | Missing or invalid authorization header | Missing auth header |
| 429 | Account temporarily locked due to too many failed login attempts | Account locked |
| 500 | Reset token has expired | Token expired |
| 500 | Reset token has already been used | Token already used |
| 500 | Invalid or expired reset token | Token not found |
| 500 | User not found | User doesn't exist |
| 500 | Current password is incorrect | Wrong current password |

---

## Rate Limiting

**Global Rate Limit:**
- 100 requests per 5 minutes per IP address

**Account Lockout:**
- 5 failed login attempts per IP address
- 15-minute lockout duration

---

## Security Headers

All responses include security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
```

---

## CORS

**Allowed Origins:** * (configurable via CORS_ORIGIN env var)

**Allowed Methods:** GET, POST, PUT, DELETE, PATCH, OPTIONS

**Allowed Headers:** Content-Type, Authorization, X-CSRF-Token

---

## Authentication

For authenticated endpoints, include the auth token in the Authorization header:

```
Authorization: Bearer pb_auth_token_...
```

---

## Audit Logging

All authentication events are logged to the `auditLogs` collection:

- Login attempts (success/failure)
- Password reset requests
- Password resets
- Password changes
- MFA verifications

Each log entry includes:
- User ID
- Event type
- Description
- IP address
- User agent
- Timestamp

---

**Last Updated:** 2026-05-08  
**Status:** ✅ PRODUCTION READY