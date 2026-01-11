# HFC Protocol - Depth-Based Commission System

## System Overview

The HFC (Horizontal Force Compression) Protocol is a **depth-based affiliate commission system** that rewards members based on their network depth and volume.

### Commission Structure

1. **Self Cashback**: 10% of personal purchases
2. **Direct Commission**: 15% from direct referrals
3. **Passive Pool**: 50% of total downline volume divided by team depth

### The Depth Formula

```
Passive Commission = (Total Downline CV * 0.50) / Max(Actual Depth, Package Min Depth)
```

**Key Concepts:**
- **Total Downline CV**: Sum of all Commissionable Value from your entire downline
- **Actual Depth**: The deepest level in your binary tree
- **Package Min Depth**: Minimum divisor set by your package (prevents infinite payouts)
- **Cap Limit**: Maximum depth your package can earn from

## Database Schema

### Core Tables

1. **profiles** - User information with sponsor relationships
2. **packages** - Affiliate packages with depth settings
3. **binary_tree** - Binary tree placement structure
4. **wallets** - User balances (self, direct, passive)
5. **orders** - All purchases with CV tracking
6. **products** - Marketplace items
7. **payout_history** - Withdrawal records

## Getting Started

### 1. Start the Server

```bash
npm start
```

Server runs on http://localhost:3000

### 2. Access Points

- **Landing Page**: http://localhost:3000/
- **User Dashboard**: http://localhost:3000/dashboard.html
- **Admin Panel**: http://localhost:3000/admin.html (requires admin account)

### 3. Create Admin Account

The first user with email `harrykohli7@gmail.com` automatically becomes admin.

1. Go to http://localhost:3000/
2. Click "Join Ecosystem"
3. Register with email: harrykohli7@gmail.com
4. Login and access Admin Panel

## Available Packages

| Package | Price | Cap Limit | Min Depth |
|---------|-------|-----------|-----------|
| Starter | $100 | 3 levels | 1 |
| Professional | $300 | 5 levels | 2 |
| Business | $500 | 7 levels | 3 |
| Enterprise | $1000 | 10 levels | 4 |

## How to Use the System

### For Admins

1. **Create Packages** (if needed):
   - Go to Master Controls
   - Enter package details
   - Set cap_limit (max depth) and min_depth

2. **Run Monthly Batch**:
   - Select month period
   - Click "RUN BATCH"
   - System calculates all commissions
   - View results in User Database tab

3. **View Reports**:
   - Check profitability metrics
   - Review user earnings
   - Monitor system health

### For Users

1. **Activate Package**:
   - Go to Membership tab
   - Select a package
   - Click "Activate"

2. **Refer Others**:
   - Share your sponsor email
   - New users enter it during signup
   - They're automatically placed in binary tree

3. **Track Earnings**:
   - View wallet balances
   - Check network growth
   - Monitor team depth

### For Vendors

1. **List Products**:
   - Go to Vendor Console
   - Enter product details
   - Set price and CV value

2. **Products appear in Marketplace** for all users

## Commission Calculation Example

**Scenario:**
- User A has Starter package (Cap: 3, Min Depth: 1)
- User A has 5 direct referrals
- Total downline makes $1000 in purchases (CV)
- Actual team depth is 2 levels

**Calculations:**

1. **Self**: User A's purchases × 10%
2. **Direct**: Direct referrals' purchases × 15%
3. **Passive**:
   - Total Downline CV = $1000
   - Pool Amount = $1000 × 0.50 = $500
   - Divisor = Max(2, 1) = 2
   - Passive Payout = $500 / 2 = **$250**

## Binary Tree Placement

The system uses **breadth-first auto-placement**:

1. New user signs up with sponsor
2. System finds first available position under sponsor
3. Searches left-to-right, level-by-level
4. Automatically places user (left or right)
5. Creates spillover effect for network growth

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/signup` - Register new user

### User Operations
- `GET /api/user-data/:userId` - Get user profile and stats
- `GET /api/packages` - List all packages
- `POST /api/activate-package` - Activate membership
- `GET /api/products` - List marketplace products

### Admin Operations
- `POST /api/admin/run-monthly` - Process monthly commissions
- `GET /api/admin/master-report` - View all user earnings
- `GET /api/admin/stats` - System statistics
- `POST /api/admin/create-package` - Create new package
- `POST /api/admin/reset-system` - Reset financial data

## Testing the System

### Quick Test Scenario

1. **Create admin account** (harrykohli7@gmail.com)
2. **Create 3 test users** with admin as sponsor:
   - user1@test.com
   - user2@test.com
   - user3@test.com
3. **Activate packages** for all users
4. **Go to Admin Panel**
5. **Select current month** in Monthly Run
6. **Click RUN BATCH**
7. **View User Database** to see commission calculations

Expected results:
- Self commissions (10% of package prices)
- Direct commissions (15% for admin from direct referrals)
- Passive pool (50% of total volume divided by depth)

## Key Features

✅ Automatic binary tree placement
✅ Depth-based passive commission formula
✅ Monthly batch processing
✅ Real-time wallet tracking
✅ Vendor marketplace integration
✅ Role-based access (admin, vendor, affiliate, consumer)
✅ Nuclear reset for testing scenarios

## Environment Variables

The system uses `.env` file with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

These are automatically loaded by the server.

## Important Notes

⚠️ **The passive commission formula uses MAX(actual_depth, min_depth)** - This ensures:
- Users with shallow networks still get fair payouts (using min_depth)
- Users with deep networks get proportionally distributed payouts (using actual_depth)
- Package upgrade incentives (higher min_depth = better shallow network payouts)

⚠️ **Monthly batch processing** - Commissions are calculated when admin runs the batch, not in real-time.

⚠️ **Binary tree spillover** - New members automatically fill available positions, creating natural growth patterns.

## Support

For questions about the HFC protocol implementation, refer to the inline comments in `server.js` (especially the depth-based formula engine section).
