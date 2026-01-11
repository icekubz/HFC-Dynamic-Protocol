# System Fixes and Commission Calculation Details

## Issues Fixed

### 1. Products Table Schema
**Problem:** Products table was missing essential columns needed by the marketplace
**Fix:** Added the following columns:
- `category_id` - Links products to categories
- `is_active` - Controls product visibility (default: true)
- `image_url` - Product image URL
- `stock_quantity` - Available inventory (default: 100)
- `sku` - Stock Keeping Unit (unique identifier)

### 2. Empty Marketplace
**Problem:** No products existed in the database
**Fix:** Seeded 24 sample products across 6 categories:
- Electronics (4 products)
- Fashion (4 products)
- Home & Garden (4 products)
- Sports & Outdoors (4 products)
- Books & Media (4 products)
- Health & Beauty (4 products)

### 3. Commission Calculation Function Signature
**Problem:** `calculateAndCreateCommissions()` was missing the `buyerId` parameter
**Fix:** Updated function signature to:
```typescript
calculateAndCreateCommissions(orderId: string, items: any[], buyerId: string, referrerId?: string)
```

### 4. Checkout Component
**Problem:** Checkout was using wrong column names and not passing buyerId to commission calculation
**Fix:**
- Changed `customer_id` to `buyer_id` in orders insert
- Added `order_type: 'product_purchase'` to track order types
- Updated commission call to pass `user.id` as buyerId

### 5. Orders Table
**Problem:** Missing `stripe_payment_intent_id` column
**Fix:** Added column with index for faster lookups

## Commission Calculation System - How It Works

### Overview
The system calculates commissions on TWO types of transactions:
1. **Monthly Package Renewals** - Affiliates pay for packages monthly
2. **Product Purchases** - Customers buy products from vendors

### Commission Flow for Product Purchases

When a customer buys a product, here's what happens:

#### Step 1: Vendor Commission (90%)
```
Product Price: $100
Platform Fee (10%): $10
Vendor Earnings (90%): $90
```
The vendor receives 90% of the sale price.

#### Step 2: Find the Buyer's Sponsor
The system checks:
1. Was there a referral link used? Use that referrer
2. If not, check the buyer's binary tree position for their sponsor
3. If found, calculate commissions for the sponsor and upline

#### Step 3: Direct Commission (Level 1)
The direct referrer/sponsor gets a commission based on their package:
```
Product Price: $100
Referrer's Package: Professional (15% direct rate)
Direct Commission: $100 × 15% = $15
```

#### Step 4: Upline Commissions (Levels 2+)
Commissions continue up the binary tree:

**Level 2 (Sponsor's Sponsor):**
```
Product Price: $100
Package: Standard (6% level 2 rate)
Level 2 Commission: $100 × 6% = $6
```

**Level 3 and beyond:**
```
Product Price: $100
Package: Basic (2.5% level 3 rate)
Level 3 Commission: $100 × 2.5% = $2.50
```

The system continues up the tree until:
- Maximum depth is reached (based on package)
- No more upline members exist
- An upline member has no active package

#### Step 5: Matching Bonus
Additional bonus calculated based on binary tree balance (left leg vs right leg volume).

### Commission Flow for Monthly Package Renewals

Every month, when affiliates pay for their packages:

#### Step 1: Self Commission (10%)
```
Package Cost: $200/month
Self Commission: $200 × 10% = $20
```
Every affiliate earns 10% back on their own package.

#### Step 2: Direct Commission to Sponsor
```
Package Cost: $200/month
Sponsor's Direct Rate: 15%
Direct Commission to Sponsor: $200 × 15% = $30
```

#### Step 3: Upline Commissions
```
Level 2: $200 × 8% = $16
Level 3: $200 × 4% = $8
And so on...
```

### Package Tiers and Rates

| Package | Monthly Cost | Direct % | Level 2 % | Level 3 % | Max Depth |
|---------|-------------|----------|-----------|-----------|-----------|
| Basic | $50 | 10% | 5% | 2.5% | 3 levels |
| Standard | $100 | 12% | 6% | 3% | 5 levels |
| Professional | $200 | 15% | 8% | 4% | 7 levels |
| Elite | $500 | 20% | 10% | 5% | 10 levels |

### Monthly Payout Process

1. **Commission Accumulation:**
   - All package renewals generate commissions
   - All product purchases generate commissions
   - Commissions marked as "pending"

2. **Monthly Processing:**
   - Admin runs monthly payout generation
   - System aggregates all pending commissions by affiliate
   - Creates payout records with detailed breakdown:
     - Self Commission
     - Direct Commission
     - Passive Commission (Levels 2+)

3. **Payout Records:**
   - Stored in `payout_history` table
   - Includes period (e.g., "2026-01")
   - Status: pending → completed → paid
   - All commission transactions marked as "paid"

### Database Tables

**commission_transactions:**
- Stores EVERY individual commission
- Tracks: affiliate_id, order_id, commission_type, amount, level, from_user_id, status
- Types: direct, level_2, level_3, matching_bonus, vendor

**payout_history:**
- Monthly aggregated payouts
- Tracks: user_id, amount, self_commission, direct_commission, passive_commission, period, status

**affiliate_subscriptions:**
- Active affiliate package subscriptions
- Links users to their current package
- Status: active, expired, cancelled

**binary_tree_positions:**
- Network structure
- Tracks: sponsor_id, parent_id, position (left/right), sales volumes

### Example Calculation

**Scenario:**
- User A buys Product ($100)
- User A's sponsor is User B (Professional package - 15% direct)
- User B's sponsor is User C (Standard package - 6% level 2)
- User C's sponsor is User D (Elite package - 5% level 3)

**Result:**
```
Vendor: $90 (90% of $100)
Platform: $10 (10% of $100)

User B (Direct): $15 (15% of $100)
User C (Level 2): $6 (6% of $100)
User D (Level 3): $5 (5% of $100)

Total Commissions Paid: $26
Platform Profit: $10 - Any matching bonuses
```

### Admin Payout Dashboard

View at: `/admin/payouts`

Shows:
- All affiliate payouts by month
- Detailed breakdown per affiliate
- Self, Direct, and Passive commission amounts
- Filter by period and status
- Total paid vs pending amounts

### Affiliate Payout View

View at: `/affiliate/payouts`

Shows:
- Personal monthly earnings
- Commission breakdown (Self/Direct/Passive)
- Payment history
- Pending vs completed payouts
- Total lifetime earnings

## How to Test

### 1. Create Test Users
```sql
-- Create users with different roles
-- Register through the UI or insert directly
```

### 2. Set Up Binary Tree
- Users refer each other
- Build a multi-level network structure
- Subscribe users to different packages

### 3. Make Product Purchases
- Log in as different users
- Buy products from the marketplace
- Check commission_transactions table

### 4. Run Monthly Payout
Use the monthly commission service:
```typescript
import { calculateMonthlyPackageCommissions, generateMonthlyPayouts } from './services/monthlyCommissionService';

// Calculate commissions for current period
await calculateMonthlyPackageCommissions('2026-01');

// Generate payout records
await generateMonthlyPayouts('2026-01');
```

### 5. View Results
- Admin: Visit `/admin/payouts`
- Affiliate: Visit `/affiliate/payouts`
- Check detailed breakdowns

## Important Notes

1. **Affiliates MUST maintain active package subscriptions** to earn commissions
2. **Package renewals happen monthly** and generate commissions each time
3. **Product commissions** are calculated immediately on purchase
4. **Binary tree structure** determines commission flow
5. **Package tier** determines commission rates and maximum depth
6. **Monthly payouts** aggregate all commissions into one payment per affiliate

## Key Service Functions

### commissionService.ts
- `calculateAndCreateCommissions()` - For product purchases
- `calculateCompanyProfit()` - Platform profit calculations

### monthlyCommissionService.ts
- `calculateMonthlyPackageCommissions()` - For package renewals
- `generateMonthlyPayouts()` - Create monthly payout records
- `calculateUserMonthlyBreakdown()` - Individual breakdown
- `getUserPayoutHistory()` - Get user's payout history
- `getAllPayoutHistory()` - Admin view all payouts

### binaryTreeService.ts
- `getUplineChain()` - Get sponsor chain
- `getUserPackage()` - Get user's active package
- `updateSalesVolume()` - Update binary tree volumes
- `calculateMatchingBonus()` - Binary tree matching bonus

---

**Last Updated:** January 11, 2026
**Build Status:** ✅ Passing
**Total Products:** 24 active products
**Commission System:** Fully operational
