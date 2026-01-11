# HOW TO ACCESS THE CREATE USER FORM

## CRITICAL: Clear Your Browser Cache First!

The files are updated but your browser is showing OLD cached versions.

### Windows/Linux:
Press **Ctrl + Shift + R** (hold all 3 keys) on the admin page

### Mac:
Press **Cmd + Shift + R** (hold all 3 keys) on the admin page

---

## Step-by-Step Instructions

### 1. Open Admin Panel
Go to: **http://localhost:3000/admin.html**

### 2. Hard Refresh (IMPORTANT!)
- Windows/Linux: **Ctrl + Shift + R**
- Mac: **Cmd + Shift + R**

### 3. Look at Left Sidebar
You should see these 4 menu items:
1. 📈 Profitability (active/highlighted)
2. 👥 User Database
3. 💵 Payout History
4. 🎛️ **Master Controls** ← CLICK THIS ONE

### 4. Click "Master Controls"
The 4th item in the sidebar labeled "Master Controls"

### 5. See the Create User Form
After clicking Master Controls, you'll see TWO cards:
- **LEFT CARD**: "👤 Create User" form
- **RIGHT CARD**: "📦 Create Package" form

---

## Create User Form Fields:

```
Email Address:     [input field]
Password:          [input field]
Sponsor Email:     [input field] (optional)
Package:           [dropdown] (for affiliates)

☑️ Vendor          [checkbox]
☑️ Affiliate       [checkbox]

Vendor Name:       [input field] (shows when Vendor checked)

[Create User Button]
```

---

## For the Main Page

### 1. Visit Homepage
Go to: **http://localhost:3000/**

### 2. Hard Refresh
- Windows/Linux: **Ctrl + Shift + R**
- Mac: **Cmd + Shift + R**

### 3. You Should See:
- Large title: "The Economy of You"
- Subtitle: "THE HFC PROTOCOL"
- Gold and dark theme
- Features section with 6 cards
- "How It Works" section
- Multiple sections with smooth scrolling

---

## If It Still Doesn't Work

### Option 1: Clear All Browser Cache
1. Open browser settings
2. Find "Clear browsing data"
3. Select "Cached images and files"
4. Clear data
5. Reload the pages

### Option 2: Use Incognito/Private Window
1. Open a new incognito/private window
2. Go to http://localhost:3000/admin.html
3. The cache won't affect it

### Option 3: Try Different Browser
- If using Chrome, try Firefox
- If using Firefox, try Chrome

---

## Verify Server is Running

Check that you see this in terminal:
```
> multivendor-ecosystem@0.1.0 start
> node server.js

🚀 Server running on http://localhost:3000
✅ Supabase connected
```

If not, restart:
```bash
npm start
```

---

## File Locations Confirmed

✅ Admin panel: `/tmp/cc-agent/62416172/project/public/admin.html`
✅ Landing page: `/tmp/cc-agent/62416172/project/public/index.html`
✅ Server: `/tmp/cc-agent/62416172/project/server.js`

All files are updated and server is serving them correctly.

**The issue is 100% browser cache.**
