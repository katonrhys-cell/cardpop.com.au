# Backend API Error Handling Bugs - Issue Tracking

## Bug #1: Generic Error Messages Without Context
**Severity:** 🟡 Medium  
**File:** `api/EcommerceApi.js`  
**Lines:** 408-410, 485-487, 562-565, 714-716  
**Status:** 🔴 OPEN

### Description
All endpoints throw generic HTTP error messages without providing helpful context or error details to calling code.

### Current Code
```javascript
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}
```

### Problems
- No error details provided to the calling code
- Cannot distinguish between different failure modes (timeout, rate limit, server error, malformed request)
- Makes debugging difficult
- Poor user experience when displaying errors to users
- Frontend cannot implement proper retry logic based on error type

### Recommended Fix
```javascript
if (!response.ok) {
  let errorDetails = await response.text().catch(() => '');
  try {
    errorDetails = JSON.parse(errorDetails);
  } catch {}
  
  const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
  error.status = response.status;
  error.details = errorDetails;
  throw error;
}
```

### Impact
- Frontend error handling is ineffective
- Users see unhelpful error messages
- Support team cannot diagnose issues from user reports

---

## Bug #2: Missing Input Validation
**Severity:** 🔴 High  
**File:** `api/EcommerceApi.js`  
**Functions:** `getProducts()`, `getProduct()`, `getProductQuantities()`, `initializeCheckout()`  
**Status:** 🔴 OPEN

### Description
No validation of function parameters, allowing invalid or malicious input to reach the API.

### Affected Parameters
- `offset`, `limit`: No validation that they are positive integers or within acceptable ranges
- `ids`, `product_ids`: No validation of array contents
- `successUrl`, `cancelUrl`: No validation that URLs are valid
- `sort_by`: No validation that it's an allowed field
- `fields`: No validation for `getProductQuantities`

### Problems
- Attackers can request 999,999,999 products at once (DoS attack)
- Invalid URLs could be accepted and processed
- Type errors if non-string IDs are passed
- No protection against unexpected input shapes

### Example Vulnerable Code (getProducts, lines 357-446)
```javascript
if (ids) {
  ids.forEach((id) => {
    queryParams.append("ids[]", id);  // ❌ No validation!
  });
}

if (limit) {
  queryParams.append("limit", String(limit));  // ❌ Could be negative or huge
}
```

### Recommended Fix
```javascript
export async function getProducts({
  ids,
  offset = 0,
  limit = 30,
  order,
  sort_by,
  is_hidden,
  to_date,
} = {}) {
  // Validate offset
  if (offset < 0 || !Number.isInteger(offset)) {
    throw new Error('Offset must be a non-negative integer');
  }
  
  // Validate limit
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }
  
  // Validate ids array
  if (ids && !Array.isArray(ids)) {
    throw new Error('IDs must be an array');
  }
  if (ids && ids.some(id => typeof id !== 'string')) {
    throw new Error('All IDs must be strings');
  }
  
  // Validate order
  if (order && !['ASC', 'DESC'].includes(String(order).toUpperCase())) {
    throw new Error('Order must be either ASC or DESC');
  }
  
  // Validate to_date
  if (to_date && isNaN(Date.parse(to_date))) {
    throw new Error('to_date must be a valid ISO date string');
  }
  
  // ... rest of function
}
```

### Impact
- Security vulnerability to DoS attacks
- Unexpected behavior if invalid data is passed
- Backend performance degradation

---

## Bug #3: Unhandled Promise Rejections
**Severity:** 🔴 High  
**File:** `api/EcommerceApi.js`  
**Function:** `initializeCheckout()`  
**Lines:** 709-722  
**Status:** 🔴 OPEN

### Description
Promise.all() used without proper error handling. If the main checkout request fails, the entire function throws without graceful fallback.

### Current Code
```javascript
const [response, language] = await Promise.all([
  checkoutInitPromise,
  getCheckoutLanguage().catch(() => "en"),  // ✅ Has fallback
]);

if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}
```

### Problems
- Main request has no error recovery
- If Hostinger API is down, checkout completely fails
- No retry logic
- Frontend gets unhandled rejection

### Recommended Fix
```javascript
let response, language;

try {
  [response, language] = await Promise.all([
    checkoutInitPromise,
    getCheckoutLanguage().catch(() => "en"),
  ]);
} catch (error) {
  throw new Error(`Checkout initialization failed: ${error.message}`);
}

if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}
```

### Impact
- Checkout failures are completely broken
- No fallback mechanism
- Poor user experience

---

## Bug #4: No Rate-Limit Error Handling
**Severity:** 🟡 Medium  
**File:** `api/EcommerceApi.js`  
**Lines:** 714-716  
**Status:** 🔴 OPEN

### Description
Cannot distinguish between different HTTP error types. A 429 (Too Many Requests) error is treated the same as a 500 (Internal Server Error).

### Current Code
```javascript
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}
```

### Problems
- Frontend cannot implement proper retry logic
- User doesn't know to wait vs. report a bug
- No exponential backoff implementation possible
- Rate limits invisible to calling code

### Recommended Fix
```javascript
if (!response.ok) {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 60;
    const error = new Error('Too many requests. Please wait before retrying.');
    error.status = 429;
    error.retryAfter = parseInt(retryAfter);
    throw error;
  } else if (response.status >= 500) {
    const error = new Error('Server error. Please try again later.');
    error.status = response.status;
    error.retryable = true;
    throw error;
  } else if (response.status === 400) {
    const error = new Error('Invalid request data.');
    error.status = 400;
    error.retryable = false;
    throw error;
  }
  
  const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
  error.status = response.status;
  throw error;
}
```

### Impact
- Frontend cannot implement smart retry logic
- Users see unhelpful error messages
- Rate limiting becomes invisible to the application

---

## Bug #5: No Request Timeout Handling
**Severity:** 🔴 High  
**File:** `api/EcommerceApi.js`  
**Functions:** `getProducts()`, `getProduct()`, `getProductQuantities()`, `initializeCheckout()`  
**Lines:** 401-406, 478-483, 556-561, 694-707  
**Status:** 🔴 OPEN

### Description
All fetch calls lack timeout protection. Requests can hang indefinitely if the server becomes unresponsive.

### Current Code
```javascript
const response = await fetch(url, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
  // ❌ No timeout!
});
```

### Problems
- Requests hang indefinitely if Hostinger API is slow
- Frontend becomes unresponsive waiting for response
- Users cannot interact with the app
- No way to cancel stuck requests
- Browser may kill the request after many minutes

### Recommended Fix
```javascript
function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  })
    .then(response => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch(error => {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    });
}

// Usage in getProducts:
const response = await fetchWithTimeout(url, {
  method: "GET",
  headers: { "Content-Type": "application/json" },
}, 10000);
```

### Impact
- Users experience frozen UI
- Timeouts escalate to server overload (retry storms)
- Poor user experience
- Difficult to diagnose issues

---

## Bug #6: Unsafe Currency Info Object Destructuring
**Severity:** 🟡 Medium  
**File:** `api/EcommerceApi.js`  
**Function:** `formatCurrency()`  
**Lines:** 9-17  
**Status:** 🔴 OPEN

### Description
Destructuring `currencyInfo` without checking if required properties exist. If `currencyInfo` is incomplete, the function proceeds but might produce incorrect results.

### Current Code
```javascript
export const formatCurrency = (priceInCents, currencyInfo) => {
  if (!currencyInfo || priceInCents === null || priceInCents === undefined) {
    return "";
  }

  const { code, symbol, template } = currencyInfo;  // ❌ No validation
  const currencyDisplay = symbol || code || "€";
  const amount = (priceInCents / 100).toFixed(2);

  if (template) {
    return template.replace("$1", amount);
  }

  return `${currencyDisplay}${amount}`;
};
```

### Problems
- If `currencyInfo` exists but lacks required properties, returns incomplete data
- No validation that `priceInCents` is actually a number
- Negative prices not handled
- Template replacement could fail if template is malformed

### Recommended Fix
```javascript
export const formatCurrency = (priceInCents, currencyInfo) => {
  // Validate inputs
  if (!currencyInfo || priceInCents === null || priceInCents === undefined) {
    return "";
  }

  // Validate price is a number
  if (typeof priceInCents !== 'number' || priceInCents < 0) {
    console.warn('Invalid price value:', priceInCents);
    return "N/A";
  }

  // Safe destructuring with defaults
  const { 
    code = 'USD', 
    symbol = '$', 
    template 
  } = currencyInfo || {};
  
  const currencyDisplay = symbol || code || "€";
  const amount = (priceInCents / 100).toFixed(2);

  if (template && typeof template === 'string') {
    return template.replace("$1", amount);
  }

  return `${currencyDisplay}${amount}`;
};
```

### Impact
- Inconsistent currency formatting
- Incorrect prices displayed to users
- Potential financial impact

---

## Summary Table

| Bug # | Issue | Severity | Type | Affected Functions |
|-------|-------|----------|------|-------------------|
| 1 | Generic error messages | 🟡 Medium | Error Handling | All endpoints |
| 2 | Missing input validation | 🔴 High | Security | getProducts, getProduct, getProductQuantities, initializeCheckout |
| 3 | Unhandled promise rejections | 🔴 High | Stability | initializeCheckout |
| 4 | No rate-limit handling | 🟡 Medium | Error Handling | All endpoints |
| 5 | No request timeouts | 🔴 High | Stability | All endpoints |
| 6 | Unsafe destructuring | 🟡 Medium | Data Integrity | formatCurrency |

## Recommended Priority

1. **CRITICAL (Fix First):** Bug #5 (Timeouts) - Causes complete app freeze
2. **CRITICAL (Fix Second):** Bug #2 (Input Validation) - Security vulnerability
3. **HIGH (Fix Third):** Bug #3 (Promise Rejection) - Checkout completely breaks
4. **MEDIUM (Fix Next):** Bug #1 (Error Messages) - Impacts user experience
5. **MEDIUM (Fix Next):** Bug #4 (Rate Limits) - Impacts user experience
6. **MEDIUM (Fix Last):** Bug #6 (Destructuring) - Data integrity

---

**Created:** 2026-05-19  
**Status:** All issues OPEN and awaiting fixes
