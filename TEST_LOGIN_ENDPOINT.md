# Login Endpoint Testing Guide

## Quick Start

### 1. Start the API Server

```bash
cd apps/api
npm run dev
```

Expected output:
```
🚀 API Server running on http://localhost:3001
```

### 2. Run the Test Script

```bash
bash TEST_LOGIN_ENDPOINT.sh
```

This will run 8 test scenarios:
1. Valid credentials
2. Invalid password
3. Missing email
4. Missing password
5. Missing IP address
6. Invalid JSON
7. Wrong Content-Type
8. Non-existent user

### 3. Check the Logs

Watch the API server logs to see detailed debugging information:
- Request headers and body
- Field extraction
- Authentication attempts
- Response data

---

## Manual Testing with curl

### Test 1: Valid Credentials

```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "katonrhys@gmail.com",
    "password": "SecurePass2026!@#",
    "ipAddress": "192.168.1.100",
    "userAgent": "curl/7.68.0"
  }'
```

**Expected Response (200 OK):**
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
  "sessionId": "session_1715168400000_abc123"
}
```

### Test 2: Invalid Password

```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "katonrhys@gmail.com",
    "password": "WrongPassword123!",
    "ipAddress": "192.168.1.100",
    "userAgent": "curl/7.68.0"
  }'
```

**Expected Response (401 Unauthorized):**
```json
{
  "error": "Invalid email or password"
}
```

### Test 3: Missing Email

```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{
    "password": "SecurePass2026!@#",
    "ipAddress": "192.168.1.100",
    "userAgent": "curl/7.68.0"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Email is required"
}
```

### Test 4: Missing Password

```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "katonrhys@gmail.com",
    "ipAddress": "192.168.1.100",
    "userAgent": "curl/7.68.0"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Password is required"
}
```

### Test 5: Missing IP Address

```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "katonrhys@gmail.com",
    "password": "SecurePass2026!@#",
    "userAgent": "curl/7.68.0"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "IP address is required"
}
```

### Test 6: Invalid JSON

```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{invalid json}'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Invalid JSON in request body"
}
```

### Test 7: Wrong Content-Type

```bash
curl -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: text/plain' \
  -d '{
    "email": "katonrhys@gmail.com",
    "password": "SecurePass2026!@#",
    "ipAddress": "192.168.1.100",
    "userAgent": "curl/7.68.0"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Request body must be valid JSON"
}
```

---

## Frontend Testing

### JavaScript/Fetch

```javascript
async function testLogin() {
  try {
    const response = await fetch('http://localhost:3001/hcgi/api/auth/login/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'katonrhys@gmail.com',
        password: 'SecurePass2026!@#',
        ipAddress: '192.168.1.100',
        userAgent: navigator.userAgent,
      }),
    });

    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));

    const data = await response.json();
    console.log('Response:', data);

    if (response.ok) {
      console.log('✅ Login successful');
      console.log('Token:', data.token);
      console.log('User:', data.user);
    } else {
      console.log('❌ Login failed');
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

testLogin();
```

### React Hook

```jsx
import { useState } from 'react';

function useLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/hcgi/api/auth/login/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          ipAddress: '192.168.1.100',
          userAgent: navigator.userAgent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return false;
      }

      setToken(data.token);
      setUser(data.user);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error, user, token };
}

export default useLogin;
```

---

## Debugging Tips

### 1. Enable Debug Logging

Set `LOG_LEVEL=debug` in `.env`:

```env
LOG_LEVEL=debug
```

Restart the API server to see detailed logs.

### 2. Check Response Headers

Use curl with `-v` flag to see response headers:

```bash
curl -v -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"email":"katonrhys@gmail.com","password":"SecurePass2026!@#","ipAddress":"192.168.1.100"}'
```

### 3. Validate JSON Response

Use `jq` to pretty-print and validate JSON:

```bash
curl -s -X POST http://localhost:3001/hcgi/api/auth/login/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"email":"katonrhys@gmail.com","password":"SecurePass2026!@#","ipAddress":"192.168.1.100"}' | jq .
```

### 4. Check API Logs

Watch the API server logs in real-time:

```bash
# Terminal 1: Start API server
cd apps/api && npm run dev

# Terminal 2: Run tests
bash TEST_LOGIN_ENDPOINT.sh

# Check logs in Terminal 1 for detailed debugging info
```

---

## Verification Checklist

- [ ] API server starts without errors
- [ ] Valid credentials return 200 OK with token
- [ ] Invalid credentials return 401 Unauthorized
- [ ] Missing fields return 400 Bad Request
- [ ] Invalid JSON returns 400 Bad Request
- [ ] Response Content-Type is `application/json`
- [ ] Response body is valid JSON
- [ ] Logs show detailed debugging information
- [ ] Frontend can parse response without errors
- [ ] Token can be used for authenticated requests

---

## Common Issues

### Issue: "Request body is not a valid JSON object"

**Solution:**
1. Verify Content-Type header is `application/json`
2. Verify JSON is valid (use `jq` to validate)
3. Check for syntax errors in JSON

### Issue: "Email is required" (but email is provided)

**Solution:**
1. Verify email is not empty string
2. Verify email is a string (not null or number)
3. Check for leading/trailing whitespace

### Issue: Response is not valid JSON

**Solution:**
1. Check response Content-Type header
2. Check response status code
3. Log response body as text: `curl -s ... | cat`
4. Check API logs for errors

### Issue: "Invalid email or password" (but credentials are correct)

**Solution:**
1. Verify user exists in PocketBase
2. Verify password is correct
3. Check PocketBase logs
4. Verify email is lowercased

---

**Status:** ✅ READY FOR TESTING
**Last Updated:** 2026-05-08
