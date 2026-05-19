# Data Integrity & Stability Checklist

This document outlines the procedures for verifying data persistence, integrity, and stability across the CardPop platform.

## 1. Vault & Card Management
- [ ] **Create Card:** Verify all fields (name, number, collection, condition, value, images) persist after saving.
- [ ] **Edit Card:** Verify that updating a single field (e.g., condition) does not nullify or clear other fields (e.g., images, description).
- [ ] **Delete Card:** Verify the card is completely removed from the database and no longer appears in the vault or marketplace.
- [ ] **Image Uploads:** Verify images are correctly attached to the PocketBase record and URLs resolve properly using `pb.files.getUrl()`.

## 2. Marketplace Listings
- [ ] **Listing Status:** Verify changing a card's status to "For Sale" or "For Trade" correctly updates the `listedForSale` and `listedForTrade` boolean flags.
- [ ] **Data Retrieval:** Verify the marketplace feed retrieves all necessary fields to render the card without errors.
- [ ] **Null Handling:** Verify cards with missing optional fields (e.g., description, grade) render gracefully with fallback UI.

## 3. Trade System
- [ ] **Offer Creation:** Verify `trade_requests` records capture both `offerer_card_id` and `recipient_card_id` correctly.
- [ ] **Value Calculation:** Verify `fee_amount` and `final_amount` are accurately calculated and stored.
- [ ] **Trade Execution:** Verify accepting a trade correctly swaps the `owner` field on both card records without losing any other card data.

## Known Issues & Notes
- **Access Rule Logic Error:** The `cards` collection currently has a logic error in its `updateRule` (`owner = @request.auth.id && @request.auth.role != 'admin' || @request.auth.role = 'admin'`). This allows any admin to update any card, but prevents an owner who is also an admin from updating their own card. *Pending migration fix.*
- **File Size Limits:** The `cardListings` collection has a 5MB limit for `cardImage`, while the `cards` collection has a 20MB limit. Ensure client-side validation matches these limits.