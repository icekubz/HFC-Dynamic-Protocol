# Thy Essential Engine (TEE) - Platform Documentation

## Overview

**Thy Essential Engine (TEE)** is a headless B2B SaaS platform that provides Infrastructure as a Service (IaaS) for calculating complex affiliate commissions and managing Web3 tokenomics for external e-commerce merchants.

This is **NOT** a consumer-facing marketplace. It is a backend engine that merchants integrate via API webhooks.

---

## Core Architecture

### 1. Database Schema

#### Main Tables

**tee_merchants**
- Stores merchant companies who use the TEE platform
- Each merchant gets an API key for webhook authentication

**tee_affiliates**
- Affiliates who promote merchant products
- Each affiliate has a unique referral code
- Linked to a sponsor (who recruited them)

**tee_binary_tree**
- Binary tree structure for organizing affiliates
- Uses BFS (Breadth-First Search) algorithm for placement
- Strict rule: NO GAPS - fills top-to-bottom, left-to-right
- Each node can have max 2 children (left and right)

**tee_orders**
- Orders received from external merchants via webhook
- Contains: order_total, commission_percent, and calculated CV
- CV (Commissionable Value) = order_total × (commission_percent / 100)

**tee_commissions**
- Individual commission records for each affiliate
- Types: self, direct, passive

**tee_wallets**
- Stores three separate balances for each affiliate:
  - `balance_self`: 10% of personal CV
  - `balance_direct`: 15% of direct referrals' CV
  - `balance_passive`: 50% of downline CV (divided by depth)
  - `hfc_token_balance`: Web3 token balance

**tee_tokenomics**
- Dynamic settings controlled by admin:
  - `mint_rate`: Tokens minted per $1 CV
  - `withdrawal_burn_rate`: % fee on fiat withdrawals
  - `total_minted`, `total_burned`, `circulating_supply`
  - `burn_fund_fiat`: Fiat allocated for token buyback/burn

---

## Commission Calculation Engine

### Total Allocation (75% to Affiliates, 25% to Platform)

When a $100 order comes in with 20% commission:
- **CV = $100 × 20% = $20**

**Affiliate Payouts (75% of CV = $15):**
1. **Self Commission (10%)** = $20 × 10% = $2.00
   - Goes to the affiliate who generated the CV

2. **Direct Commission (15%)** = $20 × 15% = $3.00
   - Goes to direct sponsor (person who recruited them)

3. **Passive Commission (50%)** = $20 × 50% = $10.00
   - Distributed to entire downline using HFC formula
   - **Formula:** `(Downline_CV × 50%) / max(CUSTOM_DIVISOR, Actual_Depth)`
   - CUSTOM_DIVISOR = 5 (hardcoded)
   - Actual_Depth = deepest level in active downline

**Platform Earning (25% of CV = $5):**
- 50% → Burn Fund = $2.50 (used to buy back and burn tokens)
- 50% → Net Profit = $2.50

---

## Binary Tree with BFS Placement

### How It Works

```
Level 0:           [Root]
                  /      \
Level 1:      [Left]    [Right]
             /    \      /    \
Level 2:  [A]    [B]  [C]    [D]
```

**Placement Rules:**
1. Start at sponsor's position in tree
2. Scan top-to-bottom, left-to-right using BFS queue
3. Place in first available empty position (left or right)
4. NO GAPS ALLOWED - must fill completely before moving to next level

**Example:**
- Affiliate 1 joins → Placed as ROOT
- Affiliate 2 joins under 1 → Placed at 1's LEFT
- Affiliate 3 joins under 1 → Placed at 1's RIGHT
- Affiliate 4 joins under 2 → Placed at 2's LEFT
- Affiliate 5 joins under 2 → Placed at 2's RIGHT
- Affiliate 6 joins under 3 → Placed at 3's LEFT

---

## Web3 Tokenomics

### Dynamic Settings (Admin Controlled)

1. **Mint Rate**
   - Default: 10 HFC tokens per $1 CV
   - When an affiliate generates $20 CV → 200 HFC tokens minted to their wallet

2. **Withdrawal Burn Rate**
   - Default: 5% fee on fiat withdrawals
   - When affiliate withdraws $100 → $5 fee → burns 50 HFC tokens

### Token Lifecycle

**Minting:**
- Triggered automatically when personal CV is generated
- Formula: `tokens_minted = personal_CV × mint_rate`
- Increases `total_minted` and `circulating_supply`

**Burning:**
- Triggered on fiat withdrawals
- Formula: `tokens_burned = burn_fee × mint_rate`
- Burn fee added to `burn_fund_fiat`
- Decreases `circulating_supply`

**Deflationary Mechanism:**
- 50% of platform earnings (12.5% of CV) → Burn Fund
- Burn Fund used to buy back and burn tokens from market
- Creates deflationary pressure on token supply

---

## API Endpoints (Supabase Edge Functions)

### 1. POST /api/webhooks/orders (tee-webhooks-orders)

**Purpose:** Accept orders from external merchants

**Payload:**
```json
{
  "merchantId": "uuid",
  "affiliateId": "uuid",
  "orderTotal": 500.00,
  "commissionPercent": 20,
  "externalOrderId": "MERCHANT_ORDER_123"
}
```

**Response:**
```json
{
  "success": true,
  "order_id": "uuid",
  "cv": 100.00,
  "message": "Order received and CV calculated successfully"
}
```

**What It Does:**
- Validates merchant and affiliate are active
- Calculates CV: `orderTotal × (commissionPercent / 100)`
- Stores order with `processed: false`
- Ready for batch commission calculation

---

### 2. POST /api/affiliates/register (tee-affiliates-register)

**Purpose:** Register new affiliate with BFS binary tree placement

**Payload:**
```json
{
  "merchantId": "uuid",
  "email": "newuser@example.com",
  "fullName": "John Doe",
  "sponsorId": "uuid-of-sponsor"
}
```

**Response:**
```json
{
  "success": true,
  "affiliate": {
    "id": "uuid",
    "email": "newuser@example.com",
    "full_name": "John Doe",
    "referral_code": "ABC123XYZ"
  },
  "tree_position": {
    "position": "left",
    "level": 2,
    "parent_id": "uuid"
  },
  "message": "Affiliate registered and placed in binary tree successfully"
}
```

**What It Does:**
- Creates new affiliate record
- Uses BFS algorithm to find next available position in sponsor's tree
- Places affiliate in binary tree (left or right)
- Creates wallet with zero balances
- Returns referral code for sharing

---

### 3. POST /api/engine/run-batch (tee-engine-run-batch)

**Purpose:** Run monthly commission calculations (Admin only)

**Payload:** `{}`

**Response:**
```json
{
  "success": true,
  "batch_id": "batch_1234567890",
  "total_cv": 1000.00,
  "total_commissions_paid": 750.00,
  "platform_earning": 250.00,
  "burn_fund_allocated": 125.00,
  "platform_net_profit": 125.00,
  "commissions_calculated": 25,
  "message": "Batch processing completed successfully"
}
```

**What It Does:**
1. Fetches all unprocessed orders
2. For each active affiliate:
   - Calculate self commission (10% of personal CV)
   - Calculate direct commission (15% of direct referrals' CV)
   - Calculate passive commission (50% of downline CV / divisor)
3. Update wallet balances
4. Mint HFC tokens based on personal CV
5. Mark orders as processed
6. Create platform ledger entry
7. Add 50% of platform earning to burn fund

---

### 4. POST /api/withdraw (tee-withdraw)

**Purpose:** Process fiat withdrawal with dynamic burn fee

**Payload:**
```json
{
  "affiliateId": "uuid",
  "amountRequested": 100.00
}
```

**Response:**
```json
{
  "success": true,
  "withdrawal_id": "uuid",
  "amount_requested": 100.00,
  "burn_fee": 5.00,
  "amount_paid": 95.00,
  "tokens_burned": 50.00,
  "remaining_balance": {
    "self": 10.00,
    "direct": 20.00,
    "passive": 15.00,
    "total": 45.00
  },
  "message": "Withdrawal processed successfully"
}
```

**What It Does:**
1. Validates affiliate has sufficient balance
2. Calculates burn fee: `amountRequested × (withdrawal_burn_rate / 100)`
3. Net payout: `amountRequested - burn_fee`
4. Calculates tokens to burn: `burn_fee × mint_rate`
5. Deducts balance (self → direct → passive order)
6. Burns HFC tokens from affiliate's wallet
7. Updates tokenomics (total_burned, circulating_supply, burn_fund_fiat)
8. Creates withdrawal record

---

## Frontend Dashboards

### Admin/CEO Panel (`/tee/admin`)

**Features:**
- Dynamic Settings
  - Update Mint Rate (tokens per $1 CV)
  - Update Withdrawal Burn Rate (% fee)
- Run Monthly Batch button
- Financial Ledger
  - Total CV Ingested
  - Total Commissions Paid (75%)
  - Platform Earning (25%)
  - Burn Fund Allocated (12.5%)
  - Net Profit (12.5%)
- Web3 Ledger
  - Total Minted
  - Total Burned
  - Circulating Supply
  - Burn Fund Fiat Value

### Affiliate Portal (`/tee/affiliate`)

**Features:**
- Earnings Breakdown
  - Self Commission Balance
  - Direct Commission Balance
  - Passive Commission Balance
  - HFC Token Balance
- API Referral Link
  - Copy referral code
  - Share link to recruit new affiliates
- Tree Position
  - Shows position (left/right/root)
  - Shows level in tree
- Withdraw Fiat
  - Enter withdrawal amount
  - Shows dynamic burn fee
  - Processes withdrawal with token burn

---

## Testing the Platform

### Test Data Included

**Test Merchant:**
- Company: "Demo Merchant Store"
- ID: `00000000-0000-0000-0000-000000000001`

**Test Affiliates (10 total):**
- affiliate1@test.com (Root)
- affiliate2@test.com (Level 1 - Left)
- affiliate3@test.com (Level 1 - Right)
- affiliate4@test.com (Level 2 - Left under 2)
- ... (more in binary tree structure)

**Test Orders (5 unprocessed):**
- Total CV: $660 across 5 orders
- Ready for batch processing

### Testing Steps

1. **Access Admin Panel**
   - Navigate to `/tee/admin`
   - View current tokenomics settings
   - See test orders waiting to be processed

2. **Run Batch Processing**
   - Click "Run Monthly Batch" button
   - Watch commissions calculate across entire tree
   - See financial ledger update

3. **Check Affiliate Wallets**
   - Navigate to `/tee/affiliate`
   - View commission breakdown
   - See HFC tokens minted

4. **Test Withdrawal**
   - Enter withdrawal amount
   - Observe burn fee calculation
   - Process withdrawal
   - Watch token balance decrease

5. **Test Affiliate Registration**
   - Use API endpoint to register new affiliate
   - Provide sponsor ID
   - Verify BFS placement in tree

---

## Key Formulas Reference

### CV Calculation
```
CV = order_total × (commission_percent / 100)
```

### Commission Calculations
```
Self Commission = personal_CV × 10%
Direct Commission = direct_referrals_CV × 15%
Passive Commission = (downline_CV × 50%) / max(5, actual_depth)
```

### Platform Split
```
Total Affiliate Payout = CV × 75%
Platform Earning = CV × 25%
  ├─ Burn Fund = Platform_Earning × 50% (12.5% of CV)
  └─ Net Profit = Platform_Earning × 50% (12.5% of CV)
```

### Token Minting
```
HFC_tokens_minted = personal_CV × mint_rate
```

### Withdrawal Burn
```
burn_fee = withdrawal_amount × (withdrawal_burn_rate / 100)
net_payout = withdrawal_amount - burn_fee
tokens_burned = burn_fee × mint_rate
```

---

## Important Notes

### Security
- All API endpoints use Supabase authentication
- RLS (Row Level Security) enabled on all tables
- Admin endpoints require admin role
- Webhook endpoints validate merchant API keys

### Data Integrity
- Binary tree placement uses atomic transactions
- Commission calculations are idempotent (can run multiple times safely)
- Orders marked as `processed` after batch run

### Scalability
- BFS algorithm efficient up to 1023 nodes (10 levels) per cap
- Batch processing can handle thousands of orders
- Edge functions auto-scale with Supabase

### Limitations
- Custom divisor hardcoded to 5 (can be made dynamic)
- Node cap hardcoded to 1023 (can be per-package)
- Withdrawal burn rate applied uniformly (could tier by volume)

---

## API Endpoint URLs

Replace `<SUPABASE_URL>` with your actual Supabase project URL:

```
POST <SUPABASE_URL>/functions/v1/tee-webhooks-orders
POST <SUPABASE_URL>/functions/v1/tee-affiliates-register
POST <SUPABASE_URL>/functions/v1/tee-engine-run-batch
POST <SUPABASE_URL>/functions/v1/tee-withdraw
```

---

## Summary

TEE is a complete affiliate commission and tokenomics engine:

✅ **Binary Tree Structure** - BFS placement with no gaps
✅ **HFC Commission Formula** - 10% self, 15% direct, 50% passive
✅ **Web3 Tokenomics** - Dynamic mint/burn with deflationary mechanics
✅ **Headless API** - Webhook-based integration for merchants
✅ **Admin Dashboard** - Full control over settings and batch processing
✅ **Affiliate Portal** - Track earnings, tokens, and withdraw funds

All commission calculations are mathematically locked and follow the exact specifications provided.
