
# COMPREHENSIVE STABILITY FIXES - Database Optimization

## 1. PocketBase Index Implementations
To drastically improve query speeds and resolve the Critical Missing Indexes issue, implement the following indices via PocketBase Admin UI or API schemas:

- **Collection `products`:** Index on `seller`, `status`, `created`.
- **Collection `cards`:** Index on `owner`, `collectionType`, `condition`, `listingStatus`, `featured`.
- **Collection `cardListings`:** Index on `owner`, `marketplaceStatus`, `askingPrice`.
- **Collection `transactions`:** Index on `userIds`, `status`, `type`.
- **Collection `tradeRequests`:** Index on `sender`, `recipient`, `status`.

## 2. Cascade Deletions
Modify relationships within PocketBase to enforce data integrity:
- `transactions.userIds` -> Enable **Cascade Delete**
- `transactions.cardIds` -> Enable **Cascade Delete**
- `tradeRequests.cardsOffered` -> Enable **Cascade Delete**

## 3. Data Validation Additions
Add strict parameters directly in the database rules:
- Add `min: 0` constraints to all financial, point, and inventory fields (e.g., `price`, `quantity`, `transactionValue`).

## 4. Orphan Record Cleanup Scripts
Execute database cleanup processes periodically using PocketBase cron jobs or API hooks:
