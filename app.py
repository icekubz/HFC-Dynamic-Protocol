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
            
            # Self
            s_amt = cv * CommissionEngine.COMM_SELF
            buyer.wallet['self'] += s_amt
            platform.current_month_ledger[buyer.id]['self'] += s_amt
            platform.month_stats['self_payout'] += s_amt
            
            # Direct
            if buyer.sponsor_id:
                sponsor = platform.users[buyer.sponsor_id]
                d_amt = cv * CommissionEngine.COMM_DIRECT
                sponsor.wallet['direct'] += d_amt
                platform.current_month_ledger[sponsor.id]['direct'] += d_amt
                platform.month_stats['direct_payout'] += d_amt

        # 2. PASSIVE (HFC POOL)
        sales_map = collections.defaultdict(float)
        for t in transactions:
            sales_map[t['buyer_id']] += t['cv']
            
        for uid, user in platform.users.items():
            # Optimization: Leaf nodes earn 0 passive
            if user.binary_left is None and user.binary_right is None:
                continue 
            
            rule = CommissionEngine.PACKAGE_RULES[user.package]
            cap = rule['cap']
            min_depth = rule['min_depth']
            
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
        # Caching for report
        self.cached_team_size = 0
        self.cached_team_depth = 0

class Platform:
    def __init__(self):
        self.users = {}
        self.user_list = []
        self.history = []
        self.current_month_ledger = {} 
        self.month_stats = {
            'revenue': 0.0, 'cv_vol': 0.0, 
            'self_payout': 0.0, 'direct_payout': 0.0, 'passive_payout': 0.0
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
            'self_payout': 0.0, 'direct_payout': 0.0, 'passive_payout': 0.0
        }
        
    def calculate_network_stats(self):
        """Calculates Team Size for ALL users efficiently (Bottom-Up)"""
        # We can't do true bottom-up easily without parent links, so we use
        # a simplified recursive cache approach for the report generation.
        # Given 15k users, we'll do a specialized iterative pass or just
        # accept BFS for the active export. 
        # For MVP stability, we will use a safe BFS per user in the export logic.
        pass

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

    def process_batch(count, items):
        nonlocal curr_idx
        for _ in range(count):
            if curr_idx < total_users:
                u = active_users[curr_idx]; curr_idx+=1
                for _ in range(items):
                    p = random.choice(CATALOG)
                    transactions.append({'buyer_id': u.id, 'cv': p['cv']})
                    sys.month_stats['revenue'] += p['price']
                    sys.month_stats['cv_vol'] += p['cv']
    
    process_batch(c1, 1)
    process_batch(c2, 2)
    process_batch(total_users - curr_idx, 3) # Rest buy 3

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

# --- VISUALIZATION ---
st.title("🚀 HFC Ecosystem: Master Dashboard")

tabs = st.tabs(["📊 Profitability", "📥 Master Report & Payouts", "🕸️ Network Analysis"])

# --- TAB 1: PROFITABILITY ---
with tabs[0]:
    if sys.history:
        last = sys.history[-1]
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Gross Revenue", f"${last['Revenue']:,.0f}")
        m2.metric("Total Payout", f"${last['Payout']:,.0f}")
        m3.metric("Platform Profit", f"${last['Margin']:,.0f}", delta="RETAINED")
        m4.metric("Active Members", f"{len(sys.users):,}")
        
        c1, c2 = st.columns(2)
        with c1:
            st.subheader("Payout Distribution")
            stats = sys.month_stats
            payout_data = pd.DataFrame([
                {"Type": "Self (Cashback)", "Val": stats['self_payout']},
                {"Type": "Direct (Sponsor)", "Val": stats['direct_payout']},
                {"Type": "Passive (Pool)", "Val": stats['passive_payout']},
                {"Type": "Company Profit", "Val": stats['cv_vol'] - (stats['self_payout']+stats['direct_payout']+stats['passive_payout'])}
            ])
            st.altair_chart(alt.Chart(payout_data).mark_arc(innerRadius=60).encode(
                theta='Val', color='Type', tooltip=['Type', 'Val']
            ).properties(height=350), use_container_width=True)
        
        with c2:
            st.subheader("Financial Trend")
            st.altair_chart(alt.Chart(pd.DataFrame(sys.history).melt('Month', ['Payout', 'Margin'], 'Type', 'Amt')).mark_area().encode(
                x='Month:O', y='Amt:Q', color='Type:N'
            ).properties(height=350), use_container_width=True)
    else:
        st.info("👈 Run Simulation to begin.")

# --- TAB 2: MASTER REPORT (FIXED) ---
with tabs[1]:
    st.header("Master Affiliate Report")
    st.markdown("Download comprehensive data: **Earnings + Downline Stats + Payouts**.")
    
    if sys.current_month_ledger:
        with st.spinner("Generating Report (Calculating Team Sizes for all users)..."):
            # Generate the FULL report
            master_data = []
            
            # Helper to count team size (BFS)
            # For 15k users this might take 2-3 seconds, which is fine for export
            for uid, u in sys.users.items():
                # Only include active users or those with earnings
                pay = sys.current_month_ledger.get(uid, {'self':0, 'direct':0, 'passive':0})
                total_earn = sum(pay.values())
                
                # Basic info
                row = {
                    "User ID": uid,
                    "Name": u.name,
                    "Package": u.package,
                    "Sponsor ID": u.sponsor_id,
                    "Self Comm ($)": round(pay['self'], 2),
                    "Direct Comm ($)": round(pay['direct'], 2),
                    "Passive Comm ($)": round(pay['passive'], 2),
                    "TOTAL PAYOUT ($)": round(total_earn, 2)
                }
                
                # Downline Stats (Only calc if necessary for speed, or calc for top earners)
                # For the Master File, we want it for everyone.
                # Simplified BFS for Export
                if u.binary_left or u.binary_right:
                    q = collections.deque([u.id])
                    count = 0
                    while q:
                        c_id = q.popleft()
                        if c_id != u.id: count += 1
                        node = sys.users[c_id]
                        if node.binary_left: q.append(node.binary_left)
                        if node.binary_right: q.append(node.binary_right)
                    row["Binary Team Size"] = count
                else:
                    row["Binary Team Size"] = 0
                
                master_data.append(row)
            
            df_master = pd.DataFrame(master_data)
            
            # Display full dataframe (no .head() limitation)
            st.dataframe(df_master, use_container_width=True)
            
            # CSV Download
            csv = df_master.to_csv(index=False).encode('utf-8')
            st.download_button(
                label="📥 Download Master CSV (Full Database)",
                data=csv,
                file_name=f"HFC_Master_Report_Month_{st.session_state.current_month-1}.csv",
                mime="text/csv"
            )
    else:
        st.warning("No data yet. Run the simulation.")

# --- TAB 3: NETWORK ANALYSIS ---
with tabs[2]:
    st.subheader("Top Performers (Verification)")
    c1, c2 = st.columns([2, 1])
    with c1:
        # Sort by Total Payout
        top = sorted(sys.users.values(), key=lambda x: sum(sys.current_month_ledger[x.id].values()), reverse=True)[:10]
        st.table(pd.DataFrame([{
            "ID": u.id, 
            "Pkg": u.package,
            "Total Payout": f"${sum(sys.current_month_ledger[u.id].values()):,.2f}",
            "Self": f"${sys.current_month_ledger[u.id]['self']:,.2f}",
            "Direct": f"${sys.current_month_ledger[u.id]['direct']:,.2f}",
            "Passive": f"${sys.current_month_ledger[u.id]['passive']:,.2f}"
        } for u in top]))
    
    with c2:
        st.write("**Deep Dive Tool**")
        uid = st.text_input("Inspect User ID", "u1a")
        if uid in sys.users:
            u = sys.users[uid]
            # Quick Stats
            pay = sys.current_month_ledger[uid]
            st.metric("Total Payout", f"${sum(pay.values()):,.2f}")
            st.metric("Passive Income", f"${pay['passive']:,.2f}")
            st.metric("Self (Cashback)", f"${pay['self']:,.2f}")
