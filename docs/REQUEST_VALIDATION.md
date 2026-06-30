# Request Validation Documentation

This document describes the request validation patterns used throughout the CardPop API. All external inputs are validated using Zod schemas before reaching business logic.

## Overview

Request validation is implemented via reusable middleware factories in `src/middleware/validateRequest.js`, with schema definitions in `src/schemas/`. This provides:

- **Early validation** before route handlers execute
- **Structured error responses** with detailed validation issues
- **Type safety** using Zod schema definitions
- **Centralized logic** for consistent validation across all routes

## Middleware Factories

Three middleware factories validate different parts of the request:

### `validateRequestBody(schema)`

Validates request body (POST, PATCH, PUT payloads).

**Returns:** 400 with `{ error: 'Invalid request body', issues: [...] }` on validation failure

**Example:**
```javascript
import { validateRequestBody } from '../middleware/validateRequest.js';
import { createClaimSchema } from '../schemas/buyerProtectionSchemas.js';

router.post('/', validateRequestBody(createClaimSchema), async (req, res) => {
  // req.body is guaranteed to match schema at this point
  const { order_id, claim_type, description } = req.body;
  // ...
});
```

### `validateRequestParams(schema)`

Validates route parameters (`:id`, `:name`, etc.).

**Returns:** 400 with `{ error: 'Invalid route parameters', issues: [...] }` on validation failure

**Example:**
```javascript
import { validateRequestParams } from '../middleware/validateRequest.js';
import { getSellerRatingsSchema } from '../schemas/sellerRatingSchemas.js';

router.get('/:sellerId', validateRequestParams(getSellerRatingsSchema), async (req, res) => {
  // req.params.sellerId is guaranteed to be valid
  const { sellerId } = req.params;
  // ...
});
```

### `validateRequestQuery(schema)`

Validates query string parameters (`?limit=10&status=open`).

**Returns:** 400 with `{ error: 'Invalid query parameters', issues: [...] }` on validation failure

**Example:**
```javascript
import { validateRequestQuery } from '../middleware/validateRequest.js';
import { getRecommendationsSchema } from '../schemas/recommendationSchemas.js';

router.get('/', validateRequestQuery(getRecommendationsSchema), async (req, res) => {
  // req.query.limit is guaranteed to be valid if provided
  const limit = parseInt(req.query.limit) || 12;
  // ...
});
```

## Schema Definition Patterns

### Basic Field Validation

```javascript
import { z } from 'zod';

export const createRatingSchema = z.object({
  seller_id: z.string().min(1, 'Seller ID is required'),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().max(1000, 'Comment must be 1000 characters or less').optional(),
  order_id: z.string().min(1, 'Order ID is required'),
});
```

Key patterns:
- Use `.min()` / `.max()` for length validation
- Use `.int()` for integer enforcement
- Use `.optional()` for optional fields
- Provide clear error messages

### Enum Validation

```javascript
export const updateClaimStatusBodySchema = z.object({
  status: z.enum(['pending', 'investigating', 'resolved', 'rejected']),
  resolution: z.string().optional(),
  refund_amount: z.number().positive('Refund amount must be positive').optional(),
});
```

Enums enforce specific allowed values with automatic validation.

### Type Coercion

For fields that accept multiple types (e.g., prices as string or number):

```javascript
export const recordMarketDataSchema = z.object({
  market_price: z.union([z.number(), z.string()])
    .transform(v => parseFloat(v))
    .pipe(z.number().positive('Market price must be positive')),
  low_price: z.union([z.number(), z.string()])
    .transform(v => v === '' || v === null ? null : parseFloat(v))
    .pipe(z.number().positive('Low price must be positive'))
    .nullable()
    .optional(),
});
```

Pattern:
- Use `.union()` to accept multiple types
- Use `.transform()` to normalize/parse
- Use `.pipe()` to validate the transformed result

### Conditional Validation

```javascript
export const reviewVerificationBodySchema = z.object({
  status: z.enum(['approved', 'rejected', 'suspended', 'revoked', 'info_requested']).optional(),
  admin_notes: z.string().max(1000).optional(),
  additional_info_requested: z.string().max(1000).optional(),
  info_request: z.boolean().optional(),
}).refine(
  (data) => data.info_request || data.status,
  { message: 'Either info_request or a valid status is required' }
);
```

Use `.refine()` for cross-field validation rules.

## Error Response Format

All validation errors return 400 with a structured response:

```json
{
  "error": "Invalid request body",
  "issues": [
    {
      "path": "rating",
      "message": "Rating must be between 1 and 5"
    },
    {
      "path": "comment",
      "message": "Comment must be 1000 characters or less"
    }
  ]
}
```

The `error` field indicates which part of the request failed:
- `Invalid request body` - POST/PATCH/PUT body validation failed
- `Invalid route parameters` - URL parameter validation failed
- `Invalid query parameters` - Query string validation failed

## Adding Validation to a Route

### Step 1: Create Schema File

Create or update `src/schemas/{domain}Schemas.js`:

```javascript
// src/schemas/exampleSchemas.js
import { z } from 'zod';

export const getItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
});

export const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  price: z.number().positive('Price must be positive'),
  category: z.enum(['electronics', 'books', 'other']),
});
```

### Step 2: Import Middleware and Schemas

```javascript
// src/routes/example.js
import { Router } from 'express';
import { validateRequestParams, validateRequestBody } from '../middleware/validateRequest.js';
import { getItemSchema, createItemSchema } from '../schemas/exampleSchemas.js';

const router = Router();
```

### Step 3: Apply Middleware to Routes

```javascript
// GET with param validation
router.get('/:itemId', validateRequestParams(getItemSchema), async (req, res) => {
  const { itemId } = req.params;
  // itemId is guaranteed to be valid
});

// POST with body validation
router.post('/', validateRequestBody(createItemSchema), async (req, res) => {
  const { name, price, category } = req.body;
  // All fields are guaranteed to match schema
});
```

### Step 4: Remove Manual Validation

Once middleware is applied, remove redundant validation from route handlers:

```javascript
// ❌ BEFORE: Manual validation (can be removed now)
if (!name || !price) {
  return res.status(400).json({ error: 'Missing fields' });
}

// ✅ AFTER: Validation handled by middleware
// Route handler receives guaranteed valid data
```

## Testing

All validation errors should be tested. Use structured test assertions:

```javascript
it('returns 400 for invalid request', async () => {
  const res = await request(app).post('/').send({ price: -10 });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('Invalid request body');
  expect(res.body.issues).toHaveLength(1);
  expect(res.body.issues[0].path).toBe('price');
});
```

## Best Practices

1. **Schema per domain** - Keep related schemas in one file (`buyerProtectionSchemas.js`, `sellerRatingSchemas.js`, etc.)

2. **Separate body and params schemas** - When a route has both:
   ```javascript
   // ✅ Good: Separate schemas
   router.put('/:id', 
     validateRequestParams(updateSchema),
     validateRequestBody(updateBodySchema),
     handler
   );
   ```

3. **Consistent error messages** - Use active voice, be specific:
   ```javascript
   // ✅ Good
   z.number().positive('Price must be positive')
   
   // ❌ Poor
   z.number().positive('Invalid price')
   ```

4. **Flexible ID validation** - Accept string IDs unless UUID is required:
   ```javascript
   // ✅ Good: Works with any ID format
   id: z.string().min(1, 'ID is required')
   
   // ❌ Restrictive: Only works with UUIDs
   id: z.string().uuid('Invalid UUID')
   ```

5. **Handle type coercion early** - When clients send strings that should be numbers, coerce in the schema, not in the route handler

6. **Document complex validations** - Use `.describe()` for non-obvious rules:
   ```javascript
   .refine((data) => data.endDate > data.startDate, {
     message: 'End date must be after start date'
   })
   ```

## Common Patterns

### Optional with Default

```javascript
// Query param with default
limit: z.string()
  .transform(v => parseInt(v, 10))
  .pipe(z.number().int().positive())
  .optional(),
```

### Enum with Error Message

```javascript
status: z.enum(['pending', 'active', 'completed'], {
  errorMap: () => ({ message: 'Invalid status value' })
}),
```

### Positive Numbers Only

```javascript
price: z.number().positive('Price must be greater than 0'),
```

### String Length Validation

```javascript
description: z.string()
  .min(10, 'Description must be at least 10 characters')
  .max(1000, 'Description must be at most 1000 characters'),
```

## Troubleshooting

### "Cannot set property query of #<IncomingMessage>"

This error occurs when trying to reassign `req.query` or `req.params` directly (they're read-only). The validation middleware handles this correctly by only validating without reassignment.

### Validation passes but data seems wrong

Verify the schema matches the actual data structure. Check for:
- Typos in field names
- Incorrect type definitions
- Missing `.transform()` steps for type coercion
- Optional fields that should be required

### Tests failing with "Invalid request body"

Update test assertions to check the structured error format:
```javascript
expect(res.body.error).toBe('Invalid request body');
expect(res.body.issues).toBeDefined();
```

## Related Documentation

- **Zod Documentation**: https://zod.dev
- **Middleware**: `src/middleware/validateRequest.js`
- **Schema Files**: `src/schemas/`
- **Tests**: `tests/backend/` (see validation test patterns)
