# Login Endpoint - Quick Test Reference

**Status:** ✅ READY TO TEST
**Endpoint:** POST /hcgi/api/auth/login/authenticate
**Base URL:** http://localhost:3001/hcgi/api

---

## 🚀 Quick Start (30 seconds)

### Terminal 1: Start API Server
```bash
cd apps/api
npm run dev
```

### Terminal 2: Test Valid Login
```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"email":"katonrhys@gmail.com","password":"SecurePass2026!@#","ipAddress":"192.168.1.100","userAgent":"curl/7.68.0"}'
```

**Expected:** 200 OK with `{"success":true,"token":"...","user":{...},"sessionId":"..."}`

---

## 💫 Test Scenarios

### 1. Valid Credentials ✅
```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"email":"katonrhys@gmail.com","password":"SecurePass2026!@#","ipAddress":"192.168.1.100","userAgent":"curl"}'
```
**Expected:** 200 OK

### 2. Invalid Password ❌
```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"email":"katonrhys@gmail.com","password":"wrong","ipAddress":"192.168.1.100","userAgent":"curl"}'
```
**Expected:** 401 Unauthorized

### 3. Missing Email ❌
```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"password":"SecurePass2026!@#","ipAddress":"192.168.1.100","userAgent":"curl"}'
```
**Expected:** 400 Bad Request

### 4. Missing Password ❌
```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"email":"katonrhys@gmail.com","ipAddress":"192.168.1.100","userAgent":"curl"}'
```
**Expected:** 400 Bad Request

### 5. Missing IP Address ❌
```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"email":"katonrhys@gmail.com","password":"SecurePass2026!@#","userAgent":"curl"}'
```
**Expected:** 400 Bad Request

### 6. Invalid JSON ❌
```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{invalid}'
```
**Expected:** 400 Bad Request

### 7. Wrong Content-Type ❌
```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: text/plain' \
  -d '{"email":"katonrhys@gmail.com","password":"SecurePass2026!@#","ipAddress":"192.168.1.100"}'
```
**Expected:** 400 Bad Request

### 8. Non-existent User ❌
```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"email":"fake@example.com","password":"SecurePass2026!@#","ipAddress":"192.168.1.100","userAgent":"curl"}'
```
**Expected:** 401 Unauthorized

---

## 💫 Run All Tests

```bash
bash TEST_LOGIN_ENDPOINT.sh
```

Runs all 8 scenarios automatically with formatted output.

---

## 🔍 Debug Logging

### Enable Debug Mode
```bash
# Edit apps/api/.env
LOG_LEVEL=debug

# Restart server
npm run dev
```

### Watch Logs
Look for:
- `[LOGIN] Request headers: Content-Type=...`
- `[LOGIN] Request body type: ...`
- `[LOGIN] Request body JSON: ...`
- `[LOGIN] /authenticate - Extracted fields:`
- `[LOGIN] /authenticate - Response data prepared:`

---

## 🚀 Frontend Test (JavaScript)

```javascript
async function testLogin() {
  const response = await fetch('http://localhost:3001/hcgi/api/auth/login/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'katonrhys@gmail.com',
      password: 'SecurePass2026!@#',
      ipAddress: '192.168.1.100',
      userAgent: navigator.userAgent,
    }),
  });

  const data = await response.json();
  console.log(response.ok ? '✅ Success' : '❌ Failed', data);
}

testLogin();
```

---

## ✅ Verification Checklist

- [ ] API server starts: `npm run dev`
- [ ] Valid login returns 200 OK
- [ ] Invalid password returns 401
- [ ] Missing email returns 400
- [ ] Missing password returns 400
- [ ] Missing IP returns 400
- [ ] Invalid JSON returns 400
- [ ] Wrong Content-Type returns 400
- [ ] Response is valid JSON
- [ ] Frontend can parse response

---

## 📚 Documentation

- **Full Guide:** `LOGIN_ENDPOINT_DEBUG_GUIDE.md`
- **Test Guide:** `TEST_LOGIN_ENDPOINT.md`
- **Summary:** `LOGIN_ENDPOINT_FIX_SUMMARY.md`
- **This File:** `QUICK_TEST_REFERENCE.md`

---

## 🔗 Response Format

### Success (200 OK)
```json
{
  "success": true,
  "token": "pb_auth_token_...",
  "user": {
    "id": "user_id",
    "email": "katonrhys@gmail.com",
    "name": "Rhys Kato",
    "avatar": ""
  },
  "sessionId": "session_..."
}
```

### Error (400/401/429)
```json
{
  "error": "Error message here"
}
```

---

**Status:** ✅ READY FOR TESTING
**Last Updated:** 2026-05-08
