# MultiVendor Financial Ecosystem - MVP Guide

## Overview

This is a comprehensive multi-vendor platform that creates a complete financial ecosystem where users can participate as:
- **Consumers**: Purchase products and earn commissions
- **Vendors**: Sell products and earn sales commissions
- **Affiliates**: Earn commissions by referring customers
- **Admins**: Manage the entire platform

## Key Features

### 1. Authentication & Roles
- Email/password registration and login
- Multi-role support: users can have multiple roles simultaneously
- Role-based access control for dashboards

### 2. Marketplace
- Browse and search active products
- Real-time product filtering by category
- Shopping cart functionality
- Integrated payment processing with Stripe (sandbox mode)

### 3. Vendor System
- Add and manage products
- Track sales and revenue
- Real-time earnings dashboard
- Product inventory management

### 4. Affiliate Program
- Generate unique referral links
- Track referral performance
- Commission structure visibility
- Request payouts

### 5. Commission System
- **Vendor Commissions**: 10% on direct sales
- **Affiliate Commissions**: 5% on referred customer purchases
- **Passive Pool**: 2% distributed to all affiliates on every sale

### 6. Dashboard Analytics
- Admin dashboard with platform analytics
- Consumer purchase history and earnings tracking
- Vendor sales metrics and performance
- Affiliate referral tracking and commission status

## Architecture

### Database Schema
- **users**: User profiles with contact information
- **user_roles**: Multi-role assignment per user
- **products**: Vendor product listings with pricing
- **categories**: Product categorization
- **orders**: Customer orders and payment status
- **order_items**: Line items in orders
- **commissions**: All commission records (vendor, affiliate, passive)
- **payouts**: Payout requests and history
- **stripe_customers**: Stripe integration mapping

### Frontend Stack
- React 18 with TypeScript
- Vite for build and dev server
- React Router for navigation
- Supabase JS client for database/auth
- Lucide React for icons
- Recharts for analytics (ready to integrate)

### Backend Services
- Supabase PostgreSQL database with RLS
- Supabase Auth for user management
- Edge Functions for Stripe payment processing
- Commission calculation service

## Getting Started

### Prerequisites
- Node.js 16+
- Supabase account (already configured)
- Stripe account (for live integration)

### Installation

```bash
npm install
npm run dev
```

The app will start on `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## Testing the MVP

### 1. Register a New Account
- Go to `/register`
- Select multiple roles: Consumer, Vendor, Affiliate
- Create account

### 2. Test Marketplace
- Navigate to `/marketplace`
- First, vendors need to add products
- Browse products and add to cart
- Complete checkout with demo Stripe card (4242 4242 4242 4242)

### 3. Test Vendor Dashboard
- Navigate to `/vendor`
- Add new products with pricing and commission percentages
- View sales and earnings metrics
- Track orders from customers

### 4. Test Affiliate Program
- Navigate to `/affiliate`
- Copy referral link to share
- Track referral performance
- Monitor commission earnings

### 5. Test Admin Dashboard
- Navigate to `/admin`
- View platform-wide statistics
- Monitor total users, products, orders, revenue

### 6. Test Consumer Account
- Navigate to `/consumer`
- View purchase history
- Track earnings from affiliate program
- Apply to become vendor

## Commission Flow

1. **Order Placed**: Customer purchases product
2. **Commission Creation**: Automatic calculation triggers
   - Vendor gets 10% of product price
   - Referring affiliate (if applicable) gets 5%
   - All active affiliates share 2% passive pool
3. **Status Tracking**: Commissions shown as "earned"
4. **Payout Request**: Users can request payment
5. **Payout Processing**: Admin processes and marks as paid

## Database Security

All tables have Row Level Security (RLS) enabled:
- Users can only read/update their own data
- Vendors can only manage their products
- Commissions are user-specific
- Admin access controlled through role

## Environment Variables

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_SUPABASE_ANON_KEY=your_anon_key
VITE_STRIPE_PUBLIC_KEY=your_stripe_public_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

## Payment Processing (Sandbox Mode)

The MVP includes:
- Payment intent creation via Edge Function
- Order creation and commission calculation
- Demo card processing (no real charges)
- Payment status tracking in database

### Testing Stripe Integration

Use these test cards:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155

Expiry: Any future date | CVC: Any 3 digits

## Future Enhancements

- Real Stripe integration with webhook handling
- Advanced analytics with charts and graphs
- Product search and filtering improvements
- Bulk product upload for vendors
- Email notifications for orders and payouts
- User verification and KYC for payouts
- Dispute resolution system
- Advanced referral tracking with UTM parameters
- Mobile app
- Multi-currency support
- Inventory management with alerts

## File Structure

```
src/
  ├── components/        # Reusable React components
  ├── pages/            # Page components for routes
  │   ├── auth/         # Login and registration
  │   └── dashboards/   # Role-specific dashboards
  ├── services/         # Business logic (commissions, payments)
  ├── hooks/            # Custom React hooks
  ├── utils/            # Utility functions and Supabase client
  ├── types/            # TypeScript type definitions
  └── App.tsx           # Main app component with routing
```

## API Endpoints

### Edge Functions
- `POST /functions/v1/create-payment-intent` - Create Stripe payment intent

## Troubleshooting

### Build Errors
```bash
npm install
npm run build
```

### Database Connection Issues
- Verify Supabase URL and keys in `.env`
- Check database tables exist (migration applied)
- Verify RLS policies are in place

### Authentication Issues
- Clear browser cookies and localStorage
- Verify user role in `user_roles` table
- Check JWT token in browser DevTools

## Backup & Recovery

Original application files backed up in `/backups/original/`

To restore:
```bash
cp backups/original/* .
```

## Support

For issues or questions:
1. Check the database schema in Supabase console
2. Review browser DevTools Network tab for API errors
3. Check browser console for React errors
4. Verify environment variables are loaded correctly
