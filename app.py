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
        # 1. PRE-CALCULATE DIRECT & SELF
        for t in transactions:
            buyer = platform.users[t['buyer_id']]
            cv = t['cv']
            
            # Self
            buyer.wallet['self'] += cv * CommissionEngine.COMM_SELF
            platform.month_stats['self_payout'] += cv * CommissionEngine.COMM_SELF
            
            # Direct
            if buyer.sponsor_id:
                sponsor = platform.users[buyer.sponsor_id]
                direct_amt = cv * CommissionEngine.COMM_DIRECT
                sponsor.wallet['direct'] += direct_amt
                platform.month_stats['direct_payout'] += direct_amt

        # 2. PASSIVE CALCULATION (Per User / Top-Down)
        sales_map = collections.defaultdict(float)
        for t in transactions:
            sales_map[t['buyer_id']] += t['cv']
            
        for uid, user in platform.users.items():
            # Optimization: Skip if no binary team
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
        self.month_stats = {'revenue': 0.0, 'cv_vol': 0.0, 'self_payout': 0.0, 'direct_payout': 0.0, 'passive_payout': 0.0}
        self.register_user("AdminRoot", 500, None)
        
    def register_user(self, name, package, sponsor_id):
        uid = f"u{len(self.users) + 1}a"
        new_user = User(uid, name, package, sponsor_id)
        self.users[uid] = new_user
        self.user_list.append(uid)
        
        # PLACEMENT: Strict Sponsor-Relative
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
        self.month_stats = {'revenue': 0.0, 'cv_vol': 0.0, 'self_payout': 0.0, 'direct_payout': 0.0, 'passive_payout': 0.0}

# ==========================================
# 🖥️ 3. STREAMLIT APP UI
# ==========================================

st.set_page_config(page_title="HFC MVP", layout="wide")

# Session State
if 'sys' not in st.session_state:
    st.session_state.sys = Platform()
    st.session_state.current_month = 1

sys = st.session_state.sys

# --- SIDEBAR: CONTROLS ---
st.sidebar.header(f"🗓️ Month {st.session_state.current_month} Controls")

with st.sidebar.form("sim_form"):
    st.subheader("1. New Growth")
    new_members_count = st.number_input("New Users Joining", value=500, step=100)
    percent_leaders = st.slider("% Leaders (Heavy Recruiters)", 1, 20, 5)

    st.subheader("2. Existing User Upgrades")
    st.info("Simulate users moving to higher tiers")
    upgrade_pct = st.slider("% of Users Upgrading Package", 0, 50, 5)

    st.subheader("3. Product Mix")
    st.caption("Distribution of what users buy this month:")
    buy_0 = st.slider("% Buying Nothing", 0, 100, 20)
    buy_1 = st.slider("% Buying 1 Item", 0, 100, 30)
    buy_2 = st.slider("% Buying 2 Items", 0, 100, 30)
    buy_3 = max(0, 100 - (buy_0 + buy_1 + buy_2))
    st.write(f"*Remaining {buy_3}% will buy 3 Items*")
    
    run_sim = st.form_submit_button("🚀 Run Month Simulation")

# --- LOGIC ---
if run_sim:
    sys.reset_month_stats()
    
    # A. PROCESS UPGRADES
    upgraded_count = 0
    if upgrade_pct > 0:
        # Filter upgradable users (100 or 250 pkg)
        candidates = [u for u in sys.users.values() if u.package < 500]
        num_upgrades = int(len(candidates) * (upgrade_pct/100))
        if num_upgrades > 0:
            upgraders = random.sample(candidates, num_upgrades)
            for u in upgraders:
                if u.package == 100: u.package = 250
                elif u.package == 250: u.package = 500
                upgraded_count += 1
    
    # B. REGISTER NEW MEMBERS
    existing_ids = sys.user_list
    weights = [1.0] * len(existing_ids)
    leader_count = int(len(existing_ids) * (percent_leaders/100))
    leader_indices = random.sample(range(len(existing_ids)), max(1, leader_count))
    for idx in leader_indices: weights[idx] = 50.0 
    
    sponsors = random.choices(existing_ids, weights=weights, k=new_members_count)
    for i in range(new_members_count):
        sponsor_id = sponsors[i]
        pkg = random.choices([100, 250, 500], weights=[25, 45, 30])[0]
        sys.register_user(f"User", pkg, sponsor_id)

    # C. TRANSACTIONS (Mixed Products)
    active_users = list(sys.users.values())
    transactions = []
    
    # Product Catalog (Name, Price, CV)
    CATALOG = [
        {"price": 20.0, "cv": 8.0},    # E-Book (40% CV)
        {"price": 100.0, "cv": 5.0},   # Grocery (5% CV)
        {"price": 150.0, "cv": 45.0},  # Software (30% CV)
        {"price": 500.0, "cv": 250.0}, # Course (50% CV)
    ]
    
    random.shuffle(active_users)
    total_users = len(active_users)
    c0, c1, c2 = int(total_users*(buy_0/100)), int(total_users*(buy_1/100)), int(total_users*(buy_2/100))
    
    curr = 0
    curr += c0 # Skip 0 buyers
    
    def gen_trans(count, num_items):
        nonlocal curr
        for _ in range(count):
            if curr < total_users:
                u = active_users[curr]
                for _ in range(num_items):
                    p = random.choice(CATALOG)
                    transactions.append({'buyer_id': u.id, 'cv': p['cv']})
                    sys.month_stats['revenue'] += p['price']
                    sys.month_stats['cv_vol'] += p['cv']
                curr += 1

    gen_trans(c1, 1)
    gen_trans(c2, 2)
    gen_trans(total_users - curr, 3)

    # D. PAYOUTS
    CommissionEngine.run_payouts(sys, transactions)
    
    # E. HISTORY
    total_payout = sys.month_stats['self_payout'] + sys.month_stats['direct_payout'] + sys.month_stats['passive_payout']
    sys.history.append({
        "Month": st.session_state.current_month,
        "Members": len(sys.users),
        "Revenue": sys.month_stats['revenue'],
        "CV Volume": sys.month_stats['cv_vol'],
        "Payout": total_payout,
        "Margin": sys.month_stats['cv_vol'] - total_payout,
        "Upgrades": upgraded_count
    })
    st.session_state.current_month += 1

# --- VISUALIZATION ---
st.title("🚀 HFC Protocol: Trackdesk MVP")
st.markdown("Live simulation of **Multi-Level Affiliate Logic** with Vendor-defined CV.")

if sys.history:
    last = sys.history[-1]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Members", f"{last['Members']:,}", f"+{new_members_count}")
    c2.metric("Monthly Revenue", f"${last['Revenue']:,.0f}")
    c3.metric("Platform Margin", f"${last['Margin']:,.0f}")
    c4.metric("User Upgrades", f"{last['Upgrades']}")
    
    # Charts
    df = pd.DataFrame(sys.history)
    tab1, tab2 = st.tabs(["Financials", "Network Growth"])
    with tab1:
        st.altair_chart(alt.Chart(df.melt('Month', ['Payout', 'Margin'], 'Type', 'Amt')).mark_bar().encode(
            x='Month:O', y='Amt:Q', color='Type:N', tooltip=['Month','Type','Amt']
        ).properties(height=300), use_container_width=True)
    with tab2:
        st.altair_chart(alt.Chart(df).mark_line(point=True).encode(
            x='Month:O', y='Members:Q', tooltip=['Month','Members']
        ).properties(height=300), use_container_width=True)

st.divider()
st.subheader("🔍 Deep Dive: Network Structure")
c1, c2 = st.columns([2,1])
with c1:
    st.write("Top 10 Earners (Verify 'Whale' Logic)")
    users = sorted(sys.users.values(), key=lambda x: sum(x.wallet.values()), reverse=True)[:10]
    st.table(pd.DataFrame([{
        "ID": u.id, "Pkg": u.package, 
        "Total": f"${sum(u.wallet.values()):,.0f}", 
        "Passive": f"${u.wallet['passive']:,.0f}",
        "Direct": f"${u.wallet['direct']:,.0f}"
    } for u in users]))
with c2:
    st.write("Lookup User Tree")
    uid = st.text_input("User ID", "u1a")
    if uid in sys.users:
        u = sys.users[uid]
        # Count team
        q, count = collections.deque([u.id]), 0
        while q:
            n = sys.users[q.popleft()]
            if n.binary_left: q.append(n.binary_left); count+=1
            if n.binary_right: q.append(n.binary_right); count+=1
        st.metric("Binary Team Size", count)
        st.metric("Passive Income", f"${u.wallet['passive']:,.2f}")
