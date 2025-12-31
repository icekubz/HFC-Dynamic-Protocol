import streamlit as st
import pandas as pd
import numpy as np
import random
import collections
import altair as alt

# ==========================================
# 📘 1. THE HFC-DYNAMIC PROTOCOL ENGINE
# ==========================================

class CommissionEngine:
    COMM_SELF = 0.10     # 10% of CV
    COMM_DIRECT = 0.15   # 15% of CV
    COMM_POOL = 0.50     # 50% of CV
    
    PACKAGE_RULES = {
        100: {"cap": 1024, "min_depth": 10},
        250: {"cap": 32768, "min_depth": 15},
        500: {"cap": 1048576, "min_depth": 20}
    }

    @staticmethod
    def run_payouts(platform, transactions):
        # Reset current month ledger
        platform.current_month_ledger = collections.defaultdict(lambda: {'self':0.0, 'direct':0.0, 'passive':0.0})
        
        # 1. DIRECT & SELF
        for t in transactions:
            buyer = platform.users[t['buyer_id']]
            cv = t['cv']
            t_type = t['type'] # 'package' or 'product'
            
            # Self
            s_amt = cv * CommissionEngine.COMM_SELF
            buyer.wallet['self'] += s_amt
            if t_type == 'package': buyer.package_wallet['self'] += s_amt
            
            platform.current_month_ledger[buyer.id]['self'] += s_amt
            platform.month_stats['self_payout'] += s_amt
            platform.month_stats[f'self_{t_type}'] += s_amt
            
            # Direct
            if buyer.sponsor_id:
                sponsor = platform.users[buyer.sponsor_id]
                d_amt = cv * CommissionEngine.COMM_DIRECT
                sponsor.wallet['direct'] += d_amt
                if t_type == 'package': sponsor.package_wallet['direct'] += d_amt
                
                platform.current_month_ledger[sponsor.id]['direct'] += d_amt
                platform.month_stats['direct_payout'] += d_amt
                platform.month_stats[f'direct_{t_type}'] += d_amt

        # 2. PASSIVE (HFC POOL)
        # Split transactions by type for accurate reporting
        pkg_trans = [t for t in transactions if t['type'] == 'package']
        prod_trans = [t for t in transactions if t['type'] == 'product']
        
        # Helper for passive loop (safe here as static method)
        def process_passive_list(batch, type_label):
            batch_map = collections.defaultdict(float)
            for t in batch: batch_map[t['buyer_id']] += t['cv']
            
            for uid, user in platform.users.items():
                if user.binary_left is None and user.binary_right is None: continue 
                
                rule = CommissionEngine.PACKAGE_RULES[user.package]
                cap = rule['cap']
                min_depth = rule['min_depth']
                
                team_cv = 0.0
                actual_depth = 0
                count = 0
                
                # BFS to gather volume
                q = collections.deque([(uid, 0)])
                while q and count < cap:
                    curr_id, d = q.popleft()
                    if curr_id != uid:
                        vol = batch_map.get(curr_id, 0.0)
                        if vol > 0:
                            team_cv += vol
                            actual_depth = max(actual_depth, d)
                        count += 1
                    node = platform.users[curr_id]
                    if node.binary_left: q.append((node.binary_left, d+1))
                    if node.binary_right: q.append((node.binary_right, d+1))
                
                if team_cv > 0:
                    divisor = max(actual_depth, min_depth)
                    payout = (team_cv * CommissionEngine.COMM_POOL) / divisor
                    
                    user.wallet['passive'] += payout
                    if type_label == 'package': user.package_wallet['passive'] += payout
                    
                    platform.current_month_ledger[user.id]['passive'] += payout
                    platform.month_stats['passive_payout'] += payout
                    platform.month_stats[f'passive_{type_label}'] += payout

        if pkg_trans: process_passive_list(pkg_trans, 'package')
        if prod_trans: process_passive_list(prod_trans, 'product')

# ==========================================
# 🏗️ 2. DATA MODELS
# ==========================================

class User:
    def __init__(self, uid, name, package, sponsor_id=None):
        self.id = uid
        self.name = name
        self.package = package
        self.sponsor_id = sponsor_id
        self.binary_left = None
        self.binary_right = None
        # Total Wallet
        self.wallet = {'self': 0.0, 'direct': 0.0, 'passive': 0.0}
        # Package-Only Wallet
        self.package_wallet = {'self': 0.0, 'direct': 0.0, 'passive': 0.0}

class Platform:
    def __init__(self):
        self.users = {}
        self.user_list = []
        self.history = []
        self.current_month_ledger = {} 
        self.month_stats = {
            'revenue': 0.0, 'cv_vol': 0.0, 
            'self_payout': 0.0, 'direct_payout': 0.0, 'passive_payout': 0.0,
            'self_package': 0.0, 'self_product': 0.0,
            'direct_package': 0.0, 'direct_product': 0.0,
            'passive_package': 0.0, 'passive_product': 0.0
        }
        self.register_user("AdminRoot", 500, None)
        
    def register_user(self, name, package, sponsor_id):
        uid = f"u{len(self.users) + 1}a"
        new_user = User(uid, name, package, sponsor_id)
        self.users[uid] = new_user
        self.user_list.append(uid)
        
        if uid != "u1a":
            start_node = sponsor_id if sponsor_id in self.users else "u1a"
            self._place_in_binary_strict(start_node, uid)
        return new_user

    def _place_in_binary_strict(self, start_node_id, new_uid):
        queue = collections.deque([start_node_id])
        while queue:
            curr_id = queue.popleft()
            curr = self.users[curr_id]
            if curr.binary_left is None:
                curr.binary_left = new_uid
                return
            else:
                queue.append(curr.binary_left)
            if curr.binary_right is None:
                curr.binary_right = new_uid
                return
            else:
                queue.append(curr.binary_right)

    def reset_month_stats(self):
        self.month_stats = {
            'revenue': 0.0, 'cv_vol': 0.0, 
            'self_payout': 0.0, 'direct_payout': 0.0, 'passive_payout': 0.0,
            'self_package': 0.0, 'self_product': 0.0,
            'direct_package': 0.0, 'direct_product': 0.0,
            'passive_package': 0.0, 'passive_product': 0.0
        }

# ==========================================
# 🖥️ 3. STREAMLIT APP UI
# ==========================================

st.set_page_config(page_title="HFC MVP", layout="wide")

if 'sys' not in st.session_state:
    st.session_state.sys = Platform()
    st.session_state.current_month = 1

sys = st.session_state.sys

# --- SIDEBAR ---
st.sidebar.title(f"🗓️ Month {st.session_state.current_month}")
with st.sidebar.form("sim_form"):
    st.subheader("1. New Growth")
    new_members_count = st.number_input("New Users Joining", value=1000, step=100)
    percent_leaders = st.slider("% Leaders", 1, 20, 5)

    st.subheader("2. Upgrades")
    upgrade_pct = st.slider("% Users Upgrading Tier", 0, 50, 5)

    st.subheader("3. Purchasing Behavior")
    buy_0 = st.slider("% Buying Nothing", 0, 100, 20)
    buy_1 = st.slider("% Buying 1 Item", 0, 100, 30)
    buy_2 = st.slider("% Buying 2 Items", 0, 100, 30)
    
    run_sim = st.form_submit_button("🚀 Run Simulation")

# --- SIMULATION ENGINE ---
if run_sim:
    sys.reset_month_stats()
    transactions = []

    # A. UPGRADES (Package Revenue)
    if upgrade_pct > 0:
        candidates = [u for u in sys.users.values() if u.package < 500]
        num = int(len(candidates) * (upgrade_pct/100))
        if num > 0:
            for u in random.sample(candidates, num):
                u.package = 500 if u.package == 250 else 250
                price = float(u.package)
                cv = price * 0.50 
                transactions.append({'buyer_id': u.id, 'cv': cv, 'type': 'package'})
                sys.month_stats['revenue'] += price
                sys.month_stats['cv_vol'] += cv
    
    # B. NEW MEMBERS (Package Revenue)
    existing_ids = sys.user_list
    weights = [1.0] * len(existing_ids)
    leader_indices = random.sample(range(len(existing_ids)), max(1, int(len(existing_ids)*(percent_leaders/100))))
    for idx in leader_indices: weights[idx] = 50.0 
    
    sponsors = random.choices(existing_ids, weights=weights, k=new_members_count)
    for i in range(new_members_count):
        pkg = random.choices([100, 250, 500], weights=[25,45,30])[0]
        new_u = sys.register_user(f"User", pkg, sponsors[i])
        
        price = float(pkg)
        cv = price * 0.50
        transactions.append({'buyer_id': new_u.id, 'cv': cv, 'type': 'package'})
        sys.month_stats['revenue'] += price
        sys.month_stats['cv_vol'] += cv

    # C. PRODUCTS (Product Revenue)
    CATALOG = [
        {"name": "E-Book", "price": 20.0, "cv": 8.0},    # 40%
        {"name": "Grocery", "price": 100.0, "cv": 5.0},  # 5%
        {"name": "Software", "price": 150.0, "cv": 45.0},# 30%
        {"name": "Course", "price": 500.0, "cv": 250.0}, # 50%
    ]
    
    active_users = list(sys.users.values())
    random.shuffle(active_users)
    total_users = len(active_users)
    c1, c2 = int(total_users*(buy_1/100)), int(total_users*(buy_2/100))
    c3 = total_users - int(total_users*(buy_0/100)) - c1 - c2
    
    curr_idx = int(total_users*(buy_0/100))

    # --- LINEAR PROCESSING (No functions, No Scope Errors) ---
    
    # 1 Item Buyers
    for _ in range(c1):
        if curr_idx < total_users:
            u = active_users[curr_idx]; curr_idx += 1
            p = random.choice(CATALOG)
            transactions.append({'buyer_id': u.id, 'cv': p['cv'], 'type': 'product'})
            sys.month_stats['revenue'] += p['price']
            sys.month_stats['cv_vol'] += p['cv']

    # 2 Item Buyers
    for _ in range(c2):
        if curr_idx < total_users:
            u = active_users[curr_idx]; curr_idx += 1
            for _ in range(2):
                p = random.choice(CATALOG)
                transactions.append({'buyer_id': u.id, 'cv': p['cv'], 'type': 'product'})
                sys.month_stats['revenue'] += p['price']
                sys.month_stats['cv_vol'] += p['cv']

    # 3 Item Buyers
    while curr_idx < total_users:
        u = active_users[curr_idx]; curr_idx += 1
        for _ in range(3):
            p = random.choice(CATALOG)
            transactions.append({'buyer_id': u.id, 'cv': p['cv'], 'type': 'product'})
            sys.month_stats['revenue'] += p['price']
            sys.month_stats['cv_vol'] += p['cv']

    # D. PAYOUTS
    CommissionEngine.run_payouts(sys, transactions)
    
    # E. HISTORY
    stats = sys.month_stats
    total_pay = stats['self_payout'] + stats['direct_payout'] + stats['passive_payout']
    
    sys.history.append({
        "Month": st.session_state.current_month,
        "Members": len(sys.users),
        "Revenue": stats['revenue'],
        "Payout": total_pay,
        "Margin": stats['cv_vol'] - total_pay,
        "Pay_Package": stats['self_package'] + stats['direct_package'] + stats['passive_package'],
        "Pay_Product": stats['self_product'] + stats['direct_product'] + stats['passive_product']
    })
    st.session_state.current_month += 1

# --- VISUALIZATION TABS ---
st.title("🚀 HFC Ecosystem: Master Dashboard")

tabs = st.tabs(["📊 Profitability", "📥 Batch Payouts", "🕸️ Network Analysis", "📋 User Database"])

# --- TAB 1: PROFITABILITY ---
with tabs[0]:
    if sys.history:
        last = sys.history[-1]
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Gross Revenue", f"${last['Revenue']:,.0f}")
        m2.metric("Total Payout", f"${last['Payout']:,.0f}")
        m3.metric("Platform Profit", f"${last['Margin']:,.0f}", delta="RETAINED")
        m4.metric("Active Members", f"{len(sys.users):,}")
        
        st.divider()
        
        c1, c2 = st.columns(2)
        with c1:
            st.subheader("Commission Source")
            source_data = pd.DataFrame([
                {"Source": "Package Sales", "Amount": last['Pay_Package']},
                {"Source": "Product Sales", "Amount": last['Pay_Product']}
            ])
            st.altair_chart(alt.Chart(source_data).mark_bar().encode(
                x='Source', y='Amount', color='Source', tooltip=['Source', 'Amount']
            ).properties(height=300), use_container_width=True)
            
        with c2:
            st.subheader("Financial Trend")
            st.altair_chart(alt.Chart(pd.DataFrame(sys.history).melt('Month', ['Payout', 'Margin'], 'Type', 'Amt')).mark_area().encode(
                x='Month:O', y='Amt:Q', color='Type:N'
            ).properties(height=300), use_container_width=True)
    else:
        st.info("👈 Run Simulation to begin.")

# --- TAB 2: EXPORT ---
with tabs[1]:
    st.header("Master Payout File")
    if sys.current_month_ledger:
        with st.spinner("Generating Report..."):
            master_data = []
            for uid, u in sys.users.items():
                pay = sys.current_month_ledger.get(uid, {'self':0, 'direct':0, 'passive':0})
                master_data.append({
                    "User ID": uid,
                    "Name": u.name,
                    "Self Comm": round(pay['self'], 2),
                    "Direct Comm": round(pay['direct'], 2),
                    "Passive Comm": round(pay['passive'], 2),
                    "TOTAL PAYOUT": round(sum(pay.values()), 2)
                })
            
            df_master = pd.DataFrame(master_data)
            st.dataframe(df_master, use_container_width=True)
            csv = df_master.to_csv(index=False).encode('utf-8')
            st.download_button("📥 Download Master CSV", csv, "HFC_Payouts.csv", "text/csv")

# --- TAB 3: NETWORK ANALYSIS ---
with tabs[2]:
    st.subheader("Affiliate Package Breakdown")
    if sys.users:
        pkg_counts = collections.Counter([u.package for u in sys.users.values()])
        c1, c2, c3 = st.columns(3)
        c1.metric("$100 Tier", pkg_counts[100])
        c2.metric("$250 Tier", pkg_counts[250])
        c3.metric("$500 Tier", pkg_counts[500])
    
    st.divider()
    st.subheader("Top Performers")
    top = sorted(sys.users.values(), key=lambda x: sum(sys.current_month_ledger[x.id].values()), reverse=True)[:10]
    st.table(pd.DataFrame([{
        "ID": u.id, "Pkg": u.package,
        "Total Payout": f"${sum(sys.current_month_ledger[u.id].values()):,.2f}",
        "Passive": f"${sys.current_month_ledger[u.id]['passive']:,.2f}"
    } for u in top]))

# --- TAB 4: USER DATABASE (UPDATED) ---
with tabs[3]:
    st.header("Comprehensive User Database")
    
    if sys.users:
        with st.spinner("Calculating Database View..."):
            db_data = []
            for u in sys.users.values():
                # BFS Team Size
                q = collections.deque([u.id])
                team_size = 0
                while q:
                    c = sys.users[q.popleft()]
                    if c.binary_left: q.append(c.binary_left); team_size+=1
                    if c.binary_right: q.append(c.binary_right); team_size+=1
                
                total_pkg_earn = sum(u.package_wallet.values())
                
                db_data.append({
                    "User ID": u.id,
                    "Package": u.package,
                    "Sponsor": u.sponsor_id,
                    "Binary Team Size": team_size,
                    "Package Comm ($)": round(total_pkg_earn, 2),
                    "Lifetime Total ($)": round(sum(u.wallet.values()), 2)
                })
            
            df_db = pd.DataFrame(db_data)
            st.dataframe(df_db, use_container_width=True)
            csv_db = df_db.to_csv(index=False).encode('utf-8')
            st.download_button("📥 Download User DB (CSV)", csv_db, "HFC_User_Database.csv", "text/csv")
    else:
        st.info("No users found.")
