# CardPop Database Schema (Supabase)

## Seller Ratings System

### Table: `seller_ratings`
Stores seller ratings and reviews from buyers.

```sql
CREATE TABLE seller_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(reviewer_id, order_id) -- One rating per order per reviewer
);

-- Indexes for performance
CREATE INDEX idx_seller_ratings_seller_id ON seller_ratings(seller_id);
CREATE INDEX idx_seller_ratings_reviewer_id ON seller_ratings(reviewer_id);
CREATE INDEX idx_seller_ratings_order_id ON seller_ratings(order_id);
```

### Table: `profiles` (Additions)
Add seller performance metrics to existing profiles table.

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS response_time INTEGER; -- in hours
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS successful_sales INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seller_tier TEXT DEFAULT 'standard'; -- standard, top-rated, verified
```

## Buyer Protection System

### Table: `buyer_protection_claims`
Stores buyer protection claims for disputes.

```sql
CREATE TABLE buyer_protection_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  claim_type TEXT NOT NULL, -- 'item_not_received', 'item_not_as_described', 'damaged', 'other'
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, investigating, resolved, rejected
  resolution TEXT,
  refund_amount DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_buyer_protection_claims_order_id ON buyer_protection_claims(order_id);
CREATE INDEX idx_buyer_protection_claims_buyer_id ON buyer_protection_claims(buyer_id);
CREATE INDEX idx_buyer_protection_claims_status ON buyer_protection_claims(status);
```

## Wishlist System

### Table: `wishlists`
Stores user wishlists.

```sql
CREATE TABLE wishlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL, -- Can reference vault_items, products, or listings
  item_type TEXT NOT NULL, -- 'vault_item', 'product', 'listing'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, item_id, item_type)
);

CREATE INDEX idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX idx_wishlists_item_id ON wishlists(item_id);
```

## Price History System

### Table: `price_history`
Stores historical price data for cards and products.

```sql
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL, -- 'vault_item', 'product'
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'AUD',
  source TEXT NOT NULL, -- 'listing', 'sale', 'market_data'
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_price_history_item_id ON price_history(item_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at);
```

## Market Data Integration

### Table: `market_data`
Stores external market data from various sources.

```sql
CREATE TABLE market_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_name TEXT NOT NULL,
  set_name TEXT,
  source TEXT NOT NULL, -- 'tcgplayer', 'ebay', 'cardmarket', etc.
  market_price DECIMAL(10,2),
  low_price DECIMAL(10,2),
  mid_price DECIMAL(10,2),
  high_price DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(card_name, set_name, source, recorded_at)
);

CREATE INDEX idx_market_data_card_name ON market_data(card_name);
CREATE INDEX idx_market_data_source ON market_data(source);
CREATE INDEX idx_market_data_recorded_at ON market_data(recorded_at);
```

## Row Level Security (RLS) Policies

### Seller Ratings
```sql
-- Enable RLS
ALTER TABLE seller_ratings ENABLE ROW LEVEL SECURITY;

-- Users can read all ratings
CREATE POLICY "Anyone can read ratings" ON seller_ratings FOR SELECT USING (true);

-- Users can only create ratings for orders they participated in
CREATE POLICY "Users can create ratings" ON seller_ratings FOR INSERT 
WITH CHECK (
  auth.uid() = reviewer_id AND
  EXISTS (
    SELECT 1 FROM orders 
    WHERE id = order_id AND 
    (buyer_id = auth.uid() OR seller_id = seller_id)
  )
);

-- Users can only update their own ratings
CREATE POLICY "Users can update own ratings" ON seller_ratings FOR UPDATE 
USING (auth.uid() = reviewer_id);

-- Users can only delete their own ratings
CREATE POLICY "Users can delete own ratings" ON seller_ratings FOR DELETE 
USING (auth.uid() = reviewer_id);
```

### Buyer Protection Claims
```sql
-- Enable RLS
ALTER TABLE buyer_protection_claims ENABLE ROW LEVEL SECURITY;

-- Users can read their own claims
CREATE POLICY "Users can read own claims" ON buyer_protection_claims FOR SELECT 
USING (auth.uid() = buyer_id);

-- Users can create claims for their own orders
CREATE POLICY "Users can create claims" ON buyer_protection_claims FOR INSERT 
WITH CHECK (
  auth.uid() = buyer_id AND
  EXISTS (
    SELECT 1 FROM orders 
    WHERE id = order_id AND buyer_id = auth.uid()
  )
);

-- Admins can update claims (add auth check for admin role)
CREATE POLICY "Admins can update claims" ON buyer_protection_claims FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE id = auth.uid() AND role = 'admin'
));
```

### Wishlists
```sql
-- Enable RLS
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Users can read their own wishlist
CREATE POLICY "Users can read own wishlist" ON wishlists FOR SELECT 
USING (auth.uid() = user_id);

-- Users can add items to their own wishlist
CREATE POLICY "Users can add to wishlist" ON wishlists FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can remove items from their own wishlist
CREATE POLICY "Users can remove from wishlist" ON wishlists FOR DELETE 
USING (auth.uid() = user_id);
```
