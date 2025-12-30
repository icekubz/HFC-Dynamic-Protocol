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
    
    # Cap = Max Members in team | Min Depth = Divisor Floor
    PACKAGE_RULES = {
        100: {"cap": 1024, "min_depth": 10},
        250: {"cap": 32768, "min_depth": 15},
        500: {"cap": 1048576, "min_depth": 20}
    }

    @staticmethod
    def run_payouts(platform, transactions):
        # Reset monthly ledger for the batch export
        platform.current_month_ledger = collections.defaultdict(lambda: {'self':0.0, 'direct':0.0, 'passive':0.0})
        
        # 1. PRE-CALCULATE DIRECT & SELF
        for t in transactions:
            buyer = platform.users[t['buyer_id']]
            cv = t['cv']
            
            # Self Commission (Cashback)
            comm_self = cv * CommissionEngine.COMM_SELF
            buyer.wallet['self'] += comm_self
            platform.current_month_ledger[buyer.id]['self'] += comm_self
            platform.month_stats['self_payout'] += comm_self
            
            # Direct Commission (Sponsor)
            if buyer.sponsor_id:
                sponsor = platform.users[buyer.sponsor_id]
                comm_direct = cv * CommissionEngine.COMM_DIRECT
                sponsor.wallet['direct'] += comm_direct
                platform.current_month_ledger[sponsor.id]['direct'] += comm_direct
                platform.month_stats['direct_payout'] += comm_direct

        # 2. PASSIVE CALCULATION (Per User / Top-Down)
        sales_map = collections.defaultdict(float)
        for t in transactions:
            sales_map[t['buyer_id']] += t['cv']
            
        for uid, user in platform.users.items():
            if user.binary_left is None and user.binary_right is None:
                continue 
            
            rule = CommissionEngine.PACKAGE_RULES[user.package]
            cap = rule['cap']
            min_depth = rule['min_depth']
            
            # BFS to gather team CV up to CAP
            team_cv = 0.0
            actual_depth = 0
            count = 0
            
            queue = collections.deque([(uid, 0)])
            
            while queue and count < cap:
                curr_id, d = queue.popleft()
                if curr_id != uid:
                    vol = sales_map.get(curr_id, 0.0)
                    if vol > 0:
                        team_cv += vol
                        actual_depth = max(actual_depth, d)
                    count += 1
                
                node = platform.users[curr_id]
                if node.binary_left: queue.append((node.binary_left, d+1))
                if node.binary_right: queue.append((node.binary_right, d+1))
            
            # APPLY FORMULA
            if team_cv > 0:
                divisor = max(actual_depth, min_depth)
                payout = (team_cv * CommissionEngine.COMM_POOL) / divisor
                
                user.wallet['passive'] += payout
                platform.current_month_ledger[user.id]['passive'] += payout
                platform.month_stats['passive_payout'] += payout

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
        self.wallet = {'self': 0.0, 'direct': 0.0, 'passive': 0.0}

class Platform:
    def __init__(self):
        self.users = {}
        self.user_list = []
        self.history = []
        self.current_month_ledger = {} 
        self.month_stats = {
            'revenue': 0.0, 'cv_vol': 0.0, 
            'self_payout': 0.0, 'direct_payout': 0.0, 'passive_payout': 0.0,
            'products_sold': collections.defaultdict(int)
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
            'products_sold': collections.defaultdict(int)
        }

# ==========================================
# 🖥️ 3. STREAMLIT APP UI
# ==========================================

st.set_page_config(page_title="HFC MVP", layout="wide")

if 'sys' not in st.session_state:
    st.session_state.sys = Platform()
    st.session_state.current_month = 1

sys = st.session_state.sys

# --- SIDEBAR: CONTROLS ---
st.sidebar.title(f"🗓️ Month {st.session_state.current_month}")
st.sidebar.markdown("---")

with st.sidebar.form("sim_form"):
    st.subheader("1. New Growth")
    new_members_count = st.number_input("New Users Joining", value=1000, step=100)
    percent_leaders = st.slider("% Leaders (Power Recruiters)", 1, 20, 5)

    st.subheader("2. Upgrades")
    upgrade_pct = st.slider("% Users Upgrading Tier", 0, 50, 5)

    st.subheader("3. Purchasing Behavior")
    st.caption("Distribution of buying habits:")
    buy_0 = st.slider("% Buying Nothing", 0, 100, 20)
    buy_1 = st.slider("% Buying 1 Item", 0, 100, 30)
    buy_2 = st.slider("% Buying 2 Items", 0, 100, 30)
    
    run_sim = st.form_submit_button("🚀 Run Simulation")

# --- SIMULATION LOGIC ---
if run_sim:
    sys.reset_month_stats()
    
    # A. UPGRADES
    if upgrade_pct > 0:
        candidates = [u for u in sys.users.values() if u.package < 500]
        num = int(len(candidates) * (upgrade_pct/100))
        if num > 0:
            for u in random.sample(candidates, num):
                u.package = 500 if u.package == 250 else 250
    
    # B. NEW MEMBERS
    existing_ids = sys.user_list
    weights = [1.0] * len(existing_ids)
    leader_indices = random.sample(range(len(existing_ids)), max(1, int(len(existing_ids)*(percent_leaders/100))))
    for idx in leader_indices: weights[idx] = 50.0 
    
    sponsors = random.choices(existing_ids, weights=weights, k=new_members_count)
    for i in range(new_members_count):
        sys.register_user(f"User", random.choices([100, 250, 500], weights=[25,45,30])[0], sponsors[i])

    # C. TRANSACTIONS
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
    transactions = []

    # Helper to generate transactions
    for _ in range(c1): 
        if curr_idx < total_users:
            u = active_users[curr_idx]; curr_idx+=1
            p = random.choice(CATALOG)
            transactions.append({'buyer_id': u.id, 'cv': p['cv']})
            sys.month_stats['revenue'] += p['price']
            sys.month_stats['cv_vol'] += p['cv']
            sys.month_stats['products_sold'][p['name']] += 1
            
    for _ in range(c2):
        if curr_idx < total_users:
            u = active_users[curr_idx]; curr_idx+=1
            for _ in range(2):
                p = random.choice(CATALOG)
                transactions.append({'buyer_id': u.id, 'cv': p['cv']})
                sys.month_stats['revenue'] += p['price']
                sys.month_stats['cv_vol'] += p['cv']
                sys.month_stats['products_sold'][p['name']] += 1

    while curr_idx < total_users:
        u = active_users[curr_idx]; curr_idx+=1
        for _ in range(3):
            p = random.choice(CATALOG)
            transactions.append({'buyer_id': u.id, 'cv': p['cv']})
            sys.month_stats['revenue'] += p['price']
            sys.month_stats['cv_vol'] += p['cv']
            sys.month_stats['products_sold'][p['name']] += 1

    # D. PAYOUTS
    CommissionEngine.run_payouts(sys, transactions)
    
    # E. HISTORY
    total_pay = sum([sys.month_stats[k] for k in ['self_payout','direct_payout','passive_payout']])
    sys.history.append({
        "Month": st.session_state.current_month,
        "Members": len(sys.users),
        "Revenue": sys.month_stats['revenue'],
        "Payout": total_pay,
        "Margin": sys.month_stats['cv_vol'] - total_pay
    })
    st.session_state.current_month += 1

# --- VISUALIZATION TABS ---
st.title("🚀 HFC Ecosystem: Trackdesk MVP")

tabs = st.tabs(["📊 Profitability (Admin)", "📥 Batch Payouts", "🕸️ Network Analysis", "📋 User Database"])

# --- TAB 1: ADMIN PROFITABILITY ---
with tabs[0]:
    if sys.history:
        last = sys.history[-1]
        
        st.subheader("Financial Performance")
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Gross Revenue", f"${last['Revenue']:,.0f}")
        m2.metric("Total Distributed", f"${last['Payout']:,.0f}", delta=f"{last['Payout']/last['Revenue']*100:.1f}% of Rev")
        m3.metric("Platform Margin", f"${last['Margin']:,.0f}", delta="PROFIT", delta_color="normal")
        m4.metric("Total Members", f"{len(sys.users):,}")
        
        st.divider()
        
        c1, c2 = st.columns(2)
        with c1:
            st.subheader("Payout Distribution")
            # Explicitly showing Self Payout here
            stats = sys.month_stats
            payout_data = pd.DataFrame([
                {"Category": "Self (Cashback)", "Amount": stats['self_payout']},
                {"Category": "Direct (Sponsor)", "Amount": stats['direct_payout']},
                {"Category": "Passive (Pool)", "Amount": stats['passive_payout']},
                {"Category": "Platform Retained", "Amount": stats['cv_vol'] - (stats['self_payout']+stats['direct_payout']+stats['passive_payout'])}
            ])
            st.altair_chart(alt.Chart(payout_data).mark_arc(innerRadius=50).encode(
                theta='Amount', color='Category', tooltip=['Category', 'Amount']
            ).properties(height=300), use_container_width=True)
            
        with c2:
            st.subheader("Profit Trend")
            hist_df = pd.DataFrame(sys.history)
            st.altair_chart(alt.Chart(hist_df.melt('Month', ['Payout', 'Margin'], 'Type', 'Amt')).mark_area().encode(
                x='Month:O', y='Amt:Q', color='Type:N', tooltip=['Month','Amt']
            ).properties(height=300), use_container_width=True)

    else:
        st.info("👈 Run the simulation to see Admin Data.")

# --- TAB 2: EXPORT ---
with tabs[1]:
    st.header("Bank Batch File Generator")
    if sys.current_month_ledger:
        export_data = []
        for uid, pay in sys.current_month_ledger.items():
            if sum(pay.values()) > 0:
                u = sys.users[uid]
                export_data.append({
                    "User ID": uid,
                    "Name": u.name,
                    "Self Comm": pay['self'],
                    "Direct Comm": pay['direct'],
                    "Passive Comm": pay['passive'],
                    "TOTAL PAYOUT": sum(pay.values())
                })
        
        df_export = pd.DataFrame(export_data)
        st.dataframe(df_export.head())
        
        csv = df_export.to_csv(index=False).encode('utf-8')
        st.download_button("📥 Download CSV", csv, "payouts.csv", "text/csv")
    else:
        st.warning("No payout data available.")

# --- TAB 3: NETWORK INTELLIGENCE ---
with tabs[2]:
    st.subheader("Top Earner Breakdown")
    c1, c2 = st.columns([2, 1])
    
    with c1:
        # Added Self Commission column here
        top_users = sorted(sys.users.values(), key=lambda x: sum(x.wallet.values()), reverse=True)[:10]
        st.table(pd.DataFrame([{
            "ID": u.id, 
            "Pkg": u.package, 
            "Total": f"${sum(u.wallet.values()):,.2f}",
            "Self (Cashback)": f"${u.wallet['self']:,.2f}", 
            "Direct": f"${u.wallet['direct']:,.2f}",
            "Passive": f"${u.wallet['passive']:,.2f}"
        } for u in top_users]))
        
    with c2:
        st.write("**Audit User**")
        uid_input = st.text_input("User ID", "u1a")
        if uid_input in sys.users:
            u = sys.users[uid_input]
            q, count = collections.deque([u.id]), 0
            while q:
                n = sys.users[q.popleft()]
                if n.binary_left: q.append(n.binary_left); count+=1
                if n.binary_right: q.append(n.binary_right); count+=1
            st.metric("Binary Team", count)
            st.metric("Total Passive", f"${u.wallet['passive']:,.2f}")
            st.metric("Total Cashback", f"${u.wallet['self']:,.2f}")

# --- TAB 4: RAW DATA ---
with tabs[3]:
    st.write("Full Database")
    all_data = []
    for u in sys.users.values():
        all_data.append({
            "ID": u.id, "Pkg": u.package, "Sponsor": u.sponsor_id,
            "Self": sum(u.wallet.values())
        })
    st.dataframe(pd.DataFrame(all_data), use_container_width=True)
