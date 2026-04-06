# TESTING & AUDIT QUICK START GUIDE

**For: Thy Essential Engine (TEE) Platform**
**Date: April 6, 2026**
**Purpose: Get testing started in 30 minutes**

---

## 📋 What You Need

1. **Access Requirements**:
   - Supabase account & project access
   - Admin user credentials (for batch processing)
   - API client (Postman, REST Client, or curl)
   - Browser (Chrome/Firefox)

2. **Information to Gather First**:
   - Your Supabase URL: `https://[project].supabase.co`
   - Anon Key: From Supabase Settings
   - Admin JWT Token: Login and get from browser console
   - Merchant ID: `00000000-0000-0000-0000-000000000001` (default test merchant)

---

## ⚡ 30-MINUTE QUICK TEST

### Minute 1-2: Environment Setup
```bash
# Open Supabase console and verify:
# 1. Database tables exist (check SQL editor)
# 2. Test data seeded (check tee_affiliates table)
# 3. Edge functions deployed (check Functions section)
```

### Minute 3-5: Test Affiliate Registration
```bash
# Copy and paste this into your API client (Postman)
POST https://[your-supabase-url]/functions/v1/tee-affiliates-register

Headers:
Content-Type: application/json

Body:
{
  "merchantId": "00000000-0000-0000-0000-000000000001",
  "email": "test-aff-1@example.com",
  "fullName": "Test Affiliate",
  "sponsorId": null
}

# Expected: 200 OK with affiliate data
```

✓ **What to Check**: Response includes `affiliateId`, `referralCode`, `position: "root"`

### Minute 6-10: Test Order Webhook
```bash
POST https://[your-supabase-url]/functions/v1/tee-webhooks-orders

Headers:
Content-Type: application/json

Body:
{
  "merchantId": "00000000-0000-0000-0000-000000000001",
  "affiliateId": "[use-id-from-previous-response]",
  "orderTotal": 1000,
  "commissionPercent": 20,
  "externalOrderId": "TEST-ORD-001"
}

# Expected: 200 OK with calculatedCv: 200
```

✓ **What to Check**: `calculatedCv = 1000 × 0.20 = 200`

### Minute 11-15: Test Batch Processing
```bash
# Get your admin JWT token:
# 1. Open browser console (F12)
# 2. Go to https://[your-app]/admin
# 3. In console, type: localStorage.getItem('sb-token')
# 4. Copy the token value

POST https://[your-supabase-url]/functions/v1/tee-engine-run-batch

Headers:
Authorization: Bearer [YOUR-JWT-TOKEN]
Content-Type: application/json

Body:
{}

# Expected: 200 OK with batch summary
```

✓ **What to Check**:
- `totalCv: > 0`
- `totalCommissionsPaid: totalCv × 0.75`
- `platformEarning: totalCv × 0.25`

### Minute 16-20: Verify Database State
```sql
-- Open Supabase SQL editor and run:

-- Check wallet balances updated
SELECT
  af.email,
  w.balance_self,
  w.balance_direct,
  w.hfc_token_balance
FROM tee_wallets w
JOIN tee_affiliates af ON w.affiliate_id = af.id
LIMIT 5;

-- Check orders marked as processed
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed
FROM tee_orders;

-- Check tokenomics updated
SELECT
  total_minted,
  total_burned,
  circulating_supply
FROM tee_tokenomics
ORDER BY updated_at DESC
LIMIT 1;
```

✓ **What to Check**:
- Wallet balances > 0
- All orders processed = true
- Circulating supply = total_minted - total_burned

### Minute 21-25: Test Withdrawal
```bash
# First, check a wallet balance
SELECT * FROM tee_wallets
WHERE affiliate_id = '[use-first-affiliate-id]' LIMIT 1;
# Note the balance_self value

# Then submit withdrawal
POST https://[your-supabase-url]/functions/v1/tee-withdraw

Headers:
Authorization: Bearer [JWT-TOKEN]
Content-Type: application/json

Body:
{
  "affiliateId": "[affiliate-id]",
  "amount": 10
}

# Expected: 200 OK
```

✓ **What to Check**:
- `netPayout = amount - burnFee`
- `burnFee = amount × 0.10`

### Minute 26-30: Verify Security
```bash
# Test 1: Try to access without token
curl https://[your-supabase-url]/functions/v1/tee-engine-run-batch \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 401 Unauthorized

# Test 2: Check RLS enforcement
# In Supabase SQL editor, try to view all wallets as different affiliate
SELECT * FROM tee_wallets;
# Expected: Only your own wallet (RLS enforced)
```

---

## ✅ TESTING CHECKLIST

### Core Functionality
- [ ] Affiliate registration works
- [ ] Binary tree created correctly
- [ ] Order webhooks recorded
- [ ] Batch processing calculates commissions
- [ ] Wallet balances updated accurately
- [ ] Withdrawals processed
- [ ] Tokens minted/burned correctly

### Data Integrity
- [ ] All rows have required fields
- [ ] No NULL values in critical fields
- [ ] Balances are positive numbers
- [ ] No duplicate orders
- [ ] Foreign key relationships intact

### Security
- [ ] Unauthorized access blocked (401)
- [ ] Admin-only endpoints protected (403)
- [ ] RLS prevents cross-affiliate data access
- [ ] Input validation working
- [ ] No SQL injection possible

### Performance
- [ ] Registration < 2 seconds
- [ ] Batch processing < 30 seconds
- [ ] Queries return < 500ms
- [ ] No database timeouts
- [ ] UI responsive

---

## 🔍 COMMON ISSUES & SOLUTIONS

### Issue 1: Edge Function Returns 404
**Solution**:
- Verify function deployed: Check Supabase Functions dashboard
- Check spelling: `tee-affiliates-register` not `tee-affiliate-register`
- Restart function or redeploy

### Issue 2: "Invalid JWT Token"
**Solution**:
- Verify token not expired (tokens expire after 1 hour)
- Get fresh token: `localStorage.getItem('sb-token')` in console
- Check token includes "Bearer " prefix in header

### Issue 3: "Insufficient Balance" When Balance > 0
**Solution**:
- Balance might be in passive (can't withdraw from passive if self/direct available)
- Check balance breakdown: `SELECT balance_self, balance_direct FROM tee_wallets`
- Withdraw only from available self balance first

### Issue 4: Orders Not Processing in Batch
**Solution**:
- Verify orders have `processed = false`
- Check affiliate `status = 'active'`
- Verify merchant `status = 'active'`
- Check SQL: `SELECT * FROM tee_orders WHERE processed = false;`

### Issue 5: Binary Tree Placement Wrong
**Solution**:
- Verify sponsor exists and is active
- Check tree structure: `SELECT * FROM tee_binary_tree;`
- Confirm BFS algorithm (left before right)
- Verify no gaps in tree

### Issue 6: "Affiliate Not Found"
**Solution**:
- Verify affiliate_id is UUID format
- Check affiliate created successfully first
- Verify merchant matches between affiliate and order
- Check SQL: `SELECT * FROM tee_affiliates WHERE id = '[id]';`

---

## 📊 KEY METRICS TO MONITOR

### Financial Metrics
```
Total CV Ingested = Sum of (order_total × commission_percent / 100)
Total Commissions = Total CV × 0.75
Platform Earning = Total CV × 0.25
Affiliate Count = SELECT COUNT(*) FROM tee_affiliates
Average Commission Per Affiliate = Total Commissions / Affiliate Count
```

### System Metrics
```
Batch Processing Time = START to COMPLETION
Orders Per Second = Orders Processed / Batch Duration
Database Query Time = < 500ms (ideal)
API Response Time = < 200ms (ideal)
Uptime = Days Without Errors / Total Days
```

### Token Metrics
```
Total Minted = SELECT total_minted FROM tee_tokenomics
Total Burned = SELECT total_burned FROM tee_tokenomics
Circulating Supply = total_minted - total_burned
Mint Rate = tokens per $1 CV (default: 10)
Burn Rate = percentage on withdrawal (default: 10%)
```

---

## 📝 DAILY CHECKLIST

**Every morning, run:**

```bash
# 1. Verify database is accessible
SELECT 1;

# 2. Check for errors in audit log
SELECT COUNT(*) FROM error_logs WHERE created_at > NOW() - INTERVAL '24 hours';

# 3. Verify orders pending processing
SELECT COUNT(*) as pending FROM tee_orders WHERE processed = false;

# 4. Check wallet balances (sum should match commissions paid)
SELECT
  SUM(balance_self + balance_direct + balance_passive) as total_balances,
  SUM(total_withdrawn) as total_withdrawn
FROM tee_wallets;

# 5. Verify tokenomics consistency
SELECT
  total_minted - total_burned as circulating_supply
FROM tee_tokenomics
ORDER BY updated_at DESC LIMIT 1;
```

✓ **Success Criteria**:
- All queries return results
- No errors
- Pending orders count reasonable
- Circulating supply = total_minted - total_burned
- Total balances reasonable

---

## 🚀 WEEKLY FULL AUDIT

**Every Friday, run comprehensive test:**

1. **Full Affiliate Registration** (5 min)
   - Register 10 new affiliates
   - Verify tree structure
   - Check all wallets created

2. **Full Batch Cycle** (10 min)
   - Create 20 test orders
   - Run batch processing
   - Verify all commissions calculated
   - Check ledger entry

3. **Security Check** (5 min)
   - Test unauthorized access
   - Verify RLS policies
   - Check rate limiting
   - Attempt SQL injection (should fail)

4. **Performance Test** (5 min)
   - Time batch processing (goal: < 30 sec for 1000 orders)
   - Check query performance (goal: < 500ms)
   - Monitor database load

5. **Data Integrity Check** (5 min)
   - Reconcile balances
   - Check for orphaned records
   - Verify no duplicates
   - Confirm referential integrity

**Total Time: 30 minutes**

---

## 🎯 SIGN-OFF TEMPLATE

```
WEEKLY TESTING REPORT
Date: [DATE]
Tester: [NAME]

STATUS: ☐ PASS  ☐ FAIL  ☐ NEEDS REVIEW

Core Functionality:    ☐ Pass  ☐ Fail
Data Integrity:       ☐ Pass  ☐ Fail
Security:            ☐ Pass  ☐ Fail
Performance:         ☐ Pass  ☐ Fail

Issues Found: [NONE / LIST ITEMS]

Signatures:
Tester: ________________  Date: ______
Reviewer: ______________  Date: ______
```

---

## 📚 REFERENCE DOCUMENTS

- **Full Testing Plan**: `TESTING_AND_AUDIT_PLAN.md` (100+ test cases)
- **Quick Scenarios**: `QUICK_TEST_SCENARIOS.md` (8 ready-to-run scenarios)
- **API Reference**: See Edge Function code in `supabase/functions/`
- **Database Schema**: Check Supabase Tables section or SQL editor

---

## 🆘 WHEN TO ESCALATE

**Immediately escalate if:**
- ❌ Database connection fails
- ❌ Authorization bypass successful
- ❌ Duplicate orders created
- ❌ Negative balance possible
- ❌ Commission calculation errors > 1%
- ❌ Batch processing fails
- ❌ API returns 5xx errors
- ❌ RLS policy bypassed

**Report within 24 hours:**
- ⚠️ API response time > 1 second
- ⚠️ Batch processing > 1 minute
- ⚠️ Minor UI/UX issues
- ⚠️ Non-critical validation errors

---

## 💡 PRO TIPS

1. **Save API requests** in Postman for reuse
2. **Use environment variables** for URLs and tokens
3. **Monitor real-time** with Supabase dashboard
4. **Set up alerts** for critical errors
5. **Schedule daily checks** as recurring task
6. **Document findings** in issue tracker
7. **Keep test data** separate from production
8. **Use staging environment** for risky tests

---

## 📞 SUPPORT

If tests fail, check:
1. Are all prerequisites met?
2. Is token still valid?
3. Are URLs correct?
4. Is data seeded?
5. Are functions deployed?

Still stuck? Review:
- `TESTING_AND_AUDIT_PLAN.md` for detailed analysis
- Edge function logs in Supabase
- Browser console (F12)
- Network tab for API responses

---

**Happy Testing! 🧪**

*Last Updated: April 6, 2026*
