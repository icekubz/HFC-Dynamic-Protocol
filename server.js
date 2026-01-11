// 🔖 BOOKMARK: HFC Protocol - Depth-Based Commission System
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const COMM_SELF = 0.10;
const COMM_DIRECT = 0.15;
const COMM_POOL_PERCENT = 0.50; // The 50% you specified

// =========================================================
// 🧠 THE DEPTH-BASED FORMULA ENGINE
// =========================================================
async function runCycleBatch(period) {
    console.log(`\n🌊 BATCH RUN: ${period}`);

    // 1. FORCED RENEWALS (Charge everyone again)
    const { data: users } = await supabase.from('profiles').select('id, current_package_id, packages(*)').not('current_package_id', 'is', null);
    
    if(users) {
        for(const u of users) {
            if(u.packages && u.packages.price > 0) {
                const { data: paid } = await supabase.from('orders').select('id').eq('buyer_id', u.id).eq('type', 'renewal').eq('period', period);
                if(!paid || paid.length === 0) {
                    await supabase.from('orders').insert({
                        buyer_id: u.id, package_id: u.current_package_id, amount: u.packages.price, cv_snapshot: u.packages.cv_value, type: 'renewal', period: period 
                    });
                }
            }
        }
    }

    // 2. FETCH DATA SNAPSHOT
    // We need the whole tree and all orders to calculate depth
    const { data: tree } = await supabase.from('binary_tree').select('*');
    const { data: orders } = await supabase.from('orders').select('buyer_id, amount, cv_snapshot').eq('period', period);
    
    if (!orders?.length) return { success: true, message: "No revenue found." };

    // Map: User -> Personal Volume for this month
    const userVol = {};
    orders.forEach(o => {
        const amt = Number(o.amount);
        const cv = Number(o.cv_snapshot || amt);
        userVol[o.buyer_id] = (userVol[o.buyer_id] || 0) + cv;
    });

    const payouts = {};
    const init = (uid) => { if(!payouts[uid]) payouts[uid] = { self:0, direct:0, passive:0 }; };

    // 3. CALCULATE SELF & DIRECT (Standard)
    // We do this simply from the orders
    const { data: ordersWithSponsor } = await supabase.from('orders').select('amount, cv_snapshot, buyer_id, profiles!buyer_id(sponsor_id)').eq('period', period);
    ordersWithSponsor.forEach(o => {
        init(o.buyer_id);
        const cv = Number(o.cv_snapshot || o.amount);
        payouts[o.buyer_id].self += (cv * COMM_SELF);
        
        if (o.profiles?.sponsor_id) {
            init(o.profiles.sponsor_id);
            payouts[o.profiles.sponsor_id].direct += (cv * COMM_DIRECT);
        }
    });

    // 4. CALCULATE PASSIVE (THE CUSTOM FORMULA)
    
    // Recursive Function to scan downline
    // Returns: { totalCV, maxDepth }
    const scanDownline = (nodeId, currentDepth, limitDepth) => {
        if (currentDepth > limitDepth) return { cv: 0, depth: 0 }; // Stop if too deep

        // Find direct children in tree
        const children = tree.filter(t => t.upline_id === nodeId);
        
        let myBranchCV = 0;
        let myBranchDepth = 0; // 0 means no children

        children.forEach(child => {
            // Get Volume from this child
            const childVol = userVol[child.user_id] || 0;
            
            // Go deeper
            const result = scanDownline(child.user_id, currentDepth + 1, limitDepth);
            
            // Add child's volume + everything below them
            myBranchCV += (childVol + result.cv);
            
            // Calculate depth (1 for child + however deep they went)
            const branchDepth = 1 + result.depth;
            if (branchDepth > myBranchDepth) myBranchDepth = branchDepth;
        });

        return { cv: myBranchCV, depth: myBranchDepth };
    };

    // Run calculation for every active user
    for (const u of users) {
        init(u.id);
        
        // A. Configs from User Package
        const limit = u.packages.cap_limit || 10; // "Cap"
        const minDepth = u.packages.min_depth || 1; // "Package Minimum Depth"
        
        // B. Run the Scanner
        const result = scanDownline(u.id, 1, limit);
        
        const totalDownlineCV = result.cv;
        const actualDepth = result.depth;
        
        // C. The Logic
        // Formula: Payout = (Total Downline CV * 0.50) / Divisor
        // Divisor: Max(Actual Team Depth, Package Minimum Depth)
        
        const divisor = Math.max(actualDepth, minDepth);
        
        if (totalDownlineCV > 0) {
            const rawPool = totalDownlineCV * COMM_POOL_PERCENT;
            const finalPay = rawPool / divisor;
            
            console.log(`User ${u.id.slice(0,4)}: DownlineCV=${totalDownlineCV} | Depth=${actualDepth} (Min ${minDepth}) | Pay=$${finalPay.toFixed(2)}`);
            
            payouts[u.id].passive = finalPay;
        }
    }

    // 5. COMMIT TO DB
    let count = 0;
    for (const [uid, p] of Object.entries(payouts)) {
        if((p.self + p.direct + p.passive) > 0) {
            await supabase.from('wallets').upsert({ user_id: uid });
            // Overwrite wallet for clean scenario testing
            await supabase.from('wallets').update({
                balance_self: p.self,
                balance_direct: p.direct,
                balance_passive: p.passive,
                total_earnings: (p.self + p.direct + p.passive)
            }).eq('user_id', uid);
            count++;
        }
    }

    return { success: true, message: `✅ Batch Complete using Depth Logic. Paid ${count} users.` };
}

// =========================================================
// 🧨 NUCLEAR RESET (FIXED: Kills everything but Admin)
// =========================================================
app.post('/api/admin/reset-system', async (req, res) => {
    console.log("🧨 WIPING SYSTEM...");
    const ADMIN_EMAIL = 'harrykohli7@gmail.com';
    
    // 1. Identify Admin
    const { data: admin } = await supabase.from('profiles').select('id').eq('email', ADMIN_EMAIL).single();
    if(!admin) return res.json({ success: false, message: "Admin not found." });

    // 2. Delete Child Tables first
    await supabase.from('payout_history').delete().neq('id', 0);
    await supabase.from('orders').delete().neq('id', 0);
    await supabase.from('binary_tree').delete().neq('user_id', admin.id); // Keep Admin as Root
    await supabase.from('wallets').delete().neq('user_id', admin.id);
    
    // 3. Delete Products & Packages
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // Important: Update Admin to null package before deleting packages
    await supabase.from('profiles').update({ current_package_id: null }).eq('id', admin.id);
    await supabase.from('packages').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 4. Delete All Users (Except Admin)
    await supabase.from('profiles').delete().neq('id', admin.id);

    // 5. Reset Admin Wallet to 0
    await supabase.from('wallets').update({ balance_self:0, balance_direct:0, balance_passive:0, total_earnings:0 }).eq('user_id', admin.id);

    res.json({ success: true, message: "System Fully Reset. Admin Preserved." });
});

// =========================================================
// 🚀 STANDARD ROUTES (Unchanged)
// =========================================================
app.post('/api/admin/run-monthly', async (req, res) => { try { const r = await runCycleBatch(req.body.period); res.json(r); } catch(e){res.json({error:e.message})} });
app.get('/api/admin/master-report', async (req, res) => {
    const { data: users } = await supabase.from('profiles').select('id, email, roles, wallets(*)');
    const report = users.map(u => ({
        id: u.id, email: u.email, role: u.roles[0],
        self: u.wallets?.[0]?.balance_self || 0,
        direct: u.wallets?.[0]?.balance_direct || 0,
        passive: u.wallets?.[0]?.balance_passive || 0,
        total: u.wallets?.[0]?.total_earnings || 0
    }));
    res.json({ success: true, report });
});
app.get('/api/admin/stats', async (req, res) => {
    const { data: orders } = await supabase.from('orders').select('amount');
    const revenue = orders ? orders.reduce((sum, o) => sum + Number(o.amount), 0) : 0;
    const { data: wallets } = await supabase.from('wallets').select('total_earnings');
    const payout = wallets ? wallets.reduce((sum, w) => sum + Number(w.total_earnings), 0) : 0;
    const { count: users } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    // Package Data
    const { data: profiles } = await supabase.from('profiles').select('packages(name)');
    const pkgs = {}; profiles.forEach(p => { const n = p.packages?.name || 'None'; pkgs[n] = (pkgs[n]||0)+1; });
    res.json({ revenue: revenue.toFixed(2), payout: payout.toFixed(2), profit: (revenue-payout).toFixed(2), users: users||0, packages: pkgs, topEarners: [] });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.json({ success: false, message: error.message });
    if (email === 'harrykohli7@gmail.com') await supabase.from('profiles').update({ roles: ['admin', 'affiliate', 'vendor', 'consumer'] }).eq('id', data.user.id);
    res.json({ success: true, userId: data.user.id });
});
app.post('/api/signup', async (req, res) => {
    const { email, password, sponsorEmail, asVendor, vendorName } = req.body;
    const { data: auth, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return res.status(400).json({ success: false, message: error.message });
    const uid = auth.user.id;
    let roles = ["consumer"]; if(asVendor) roles.push("vendor"); if(email==='harrykohli7@gmail.com') roles=['admin','affiliate','vendor','consumer'];
    let finalSponsor = null; if(sponsorEmail) { const { data: s } = await supabase.from('profiles').select('id').eq('email', sponsorEmail).single(); if(s) finalSponsor = s.id; }
    await supabase.from('profiles').insert({ id: uid, email, roles, vendor_name: asVendor ? vendorName : null, sponsor_id: finalSponsor });
    await supabase.from('wallets').insert({ user_id: uid });
    await supabase.rpc('place_affiliate', { new_user_id: uid, sponsor_id: finalSponsor });
    res.json({ success: true, userId: uid });
});
app.post('/api/activate-package', async (req, res) => {
    const { userId, packageId } = req.body; const { data: pkg } = await supabase.from('packages').select('*').eq('id', packageId).single();
    await supabase.from('orders').insert({ buyer_id: userId, package_id: packageId, amount: pkg.price, cv_snapshot: pkg.cv_value, type: 'package', period: new Date().toISOString().slice(0, 7) });
    await supabase.from('profiles').update({ current_package_id: packageId, roles: ['affiliate','consumer'] }).eq('id', userId);
    res.json({ success: true, message: "Activated!" });
});
app.post('/api/admin/create-package', async (req, res) => { const { name, price, cv, depth } = req.body; await supabase.from('packages').insert({ name, price: parseFloat(price), cv_value: parseFloat(cv), cap_limit: parseInt(depth) }); res.json({ success: true, message: "Created!" }); });
app.get('/api/user-data/:userId', async (req, res) => {
    const { userId } = req.params;
    const { data: p } = await supabase.from('profiles').select('*, packages(*)').eq('id', userId).single();
    const { data: w } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
    const { count: d } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('sponsor_id', userId);
    const { data: ord } = await supabase.from('orders').select('*, products(name)').eq('buyer_id', userId).order('created_at', {ascending:false});
    res.json({ profile: p, wallet: w || {}, orders: ord || [], team: { directs: d||0 } });
});
app.get('/api/products', async (req, res) => { const { data } = await supabase.from('products').select('*'); res.json(data || []); });
app.get('/api/packages', async (req, res) => { const { data } = await supabase.from('packages').select('*').order('price'); res.json(data || []); });

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 HFC PROTOCOL SERVER READY on port ${PORT}`));