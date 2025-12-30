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
        """
        Processes a batch of transactions for the month.
        """
        # 1. PRE-CALCULATE DIRECT & SELF (Fast Loop)
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
        
        # Create a map of sales for fast lookup: {user_id: total_cv_generated_this_month}
        sales_map = collections.defaultdict(float)
        for t in transactions:
            sales_map[t['buyer_id']] += t['cv']
            
        # Iterate all users to calculate their Passive Income
        for uid, user in platform.users.items():
            if user.binary_left is None and user.binary_right is None:
                continue # Skip leaf nodes (no team)
            
            rule = CommissionEngine.PACKAGE_RULES[user.package]
            cap = rule['cap']
            min_depth = rule['min_depth']
            
            # BFS to gather team CV up to CAP
            team_cv = 0.0
            actual_depth = 0
            count = 0
            
            queue = collections.deque([(uid, 0)]) # (id, depth)
            
            while queue and count < cap:
                curr_id, d = queue.popleft()
                
                if curr_id != uid:
                    # Add this person's volume to the User's passive pot
                    vol = sales_map.get(curr_id, 0.0)
                    if vol > 0:
                        team_cv += vol
                        actual_depth = max(actual_depth, d)
                    count += 1
                
                # Traverse
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
        self.user_list = [] # For indexed access
        self.history = [] # Stores monthly summaries
        self.month_stats = {
            'revenue': 0.0, 'cv_vol': 0.0, 
            'self_payout': 0.0, 'direct_payout': 0.0, 'passive_payout': 0.0
        }
        
        # Init Root
        self.register_user("AdminRoot", 500, None)
        
    def register_user(self, name, package, sponsor_id):
        uid = f"u{len(self.users) + 1}a"
        new_user = User(uid, name, package, sponsor_id)
        self.users[uid] = new_user
        self.user_list.append(uid)
        
        # PLACEMENT LOGIC: STRICT SPONSOR-RELATIVE
        # 1. Start searching at the Sponsor (sponsor_id)
        # 2. Fill their subtree Top-to-Bottom, Left-to-Right
        
        if uid != "u1a":
            # If sponsor exists in system, place under them. Else under Root.
            start_node = sponsor_id if sponsor_id in self.users else "u1a"
            self._place_in_binary_strict(start_node, uid)
            
        return new_user

    def _place_in_binary_strict(self, start_node_id, new_uid):
        """
        Finds the first empty spot in the SUBTREE of start_node_id.
        Strict BFS: Always check Left, then Right.
        """
        queue = collections.deque([start_node_id])
        
        while queue:
            curr_id = queue.popleft()
            curr = self.users[curr_id]
            
            # Check Left
            if curr.binary_left is None:
                curr.binary_left = new_uid
                return
            else:
                queue.append(curr.binary_left)
                
            # Check Right
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

# ==========================================
# 🖥️ 3. STREAMLIT APP UI
# ==========================================

st.set_page_config(page_title="HFC Simulation", layout="wide")

# Session State
if 'sys' not in st.session_state:
    st.session_state.sys = Platform()
    st.session_state.current_month = 1

sys = st.session_state.sys

# --- SIDEBAR: SIMULATION CONTROLS ---
st.sidebar.header(f"🗓️ Simulator: Month {st.session_state.current_month}")

with st.sidebar.form("sim_form"):
    st.subheader("1. Growth (New Members)")
    new_members_count = st.number_input("New Affiliates Joining", value=1000, step=100)
    
    st.subheader("2. Recruiting Distribution")
    st.info("How many people do the hard work?")
    percent_leaders = st.slider("% of 'Leaders' (Heavy Recruiters)", 1, 20, 5)
    
    st.subheader("3. Purchasing Behavior")
    st.write("Define % of ALL users buying products:")
    buy_0 = st.slider("% Buying 0 Products", 0, 100, 20)
    buy_1 = st.slider("% Buying 1 Product ($100)", 0, 100, 30)
    buy_2 = st.slider("% Buying 2 Products ($200)", 0, 100, 30)
    # Remaining goes to 3 products
    buy_3 = max(0, 100 - (buy_0 + buy_1 + buy_2))
    st.caption(f"Remaining {buy_3}% will buy 3 Products ($300)")
    
    run_sim = st.form_submit_button("🚀 Run Simulation for Month")

# --- SIMULATION LOGIC ---
if run_sim:
    sys.reset_month_stats()
    
    # A. ADD NEW MEMBERS (UNEVEN GROWTH)
    # We select sponsors based on weights.
    # Leaders get high weight (recruit many). Passive users get low weight.
    existing_ids = sys.user_list
    weights = [1.0] * len(existing_ids)
    
    # Assign heavy weights to the "Leaders"
    leader_count = int(len(existing_ids) * (percent_leaders/100))
    # Pick random leaders if not already tracked, but for simplicity we randomize indices
    # To keep it "Uneven", we pick random indices to be the leaders for this month
    leader_indices = random.sample(range(len(existing_ids)), max(1, leader_count))
    
    for idx in leader_indices:
        weights[idx] = 50.0 # Leaders are 50x more likely to recruit
        
    sponsors = random.choices(existing_ids, weights=weights, k=new_members_count)
    
    with st.spinner(f"Registering {new_members_count} new members (Strict Subtree Placement)..."):
        for i in range(new_members_count):
            sponsor_id = sponsors[i]
            pkg = random.choices([100, 250, 500], weights=[25, 45, 30])[0]
            sys.register_user(f"User", pkg, sponsor_id)
            
    # B. GENERATE TRANSACTIONS
    active_users = list(sys.users.values())
    transactions = []
    
    # Product Params (Average)
    PROD_PRICE = 100.0
    PROD_CV = 40.0 # 40% CV
    
    # Shuffle to randomize who buys
    random.shuffle(active_users)
    total_users = len(active_users)
    
    # Calculate counts
    c0 = int(total_users * (buy_0/100))
    c1 = int(total_users * (buy_1/100))
    c2 = int(total_users * (buy_2/100))
    
    with st.spinner("Processing Transactions & Commissions..."):
        current_idx = 0
        
        # Skip 0 buyers
        current_idx += c0
        
        # 1 Product Buyers
        for i in range(c1):
            if current_idx < total_users:
                u = active_users[current_idx]
                transactions.append({'buyer_id': u.id, 'cv': PROD_CV})
                sys.month_stats['revenue'] += PROD_PRICE
                sys.month_stats['cv_vol'] += PROD_CV
                current_idx += 1
                
        # 2 Product Buyers
        for i in range(c2):
            if current_idx < total_users:
                u = active_users[current_idx]
                transactions.append({'buyer_id': u.id, 'cv': PROD_CV*2})
                sys.month_stats['revenue'] += PROD_PRICE*2
                sys.month_stats['cv_vol'] += PROD_CV*2
                current_idx += 1
                
        # 3 Product Buyers (Rest)
        while current_idx < total_users:
            u = active_users[current_idx]
            transactions.append({'buyer_id': u.id, 'cv': PROD_CV*3})
            sys.month_stats['revenue'] += PROD_PRICE*3
            sys.month_stats['cv_vol'] += PROD_CV*3
            current_idx += 1

        # C. RUN PAYOUTS
        CommissionEngine.run_payouts(sys, transactions)
    
    # D. SAVE HISTORY
    total_payout = sys.month_stats['self_payout'] + sys.month_stats['direct_payout'] + sys.month_stats['passive_payout']
    sys.history.append({
        "Month": st.session_state.current_month,
        "Members": len(sys.users),
        "Revenue": sys.month_stats['revenue'],
        "CV Volume": sys.month_stats['cv_vol'],
        "Payout": total_payout,
        "Margin": sys.month_stats['cv_vol'] - total_payout
    })
    
    st.session_state.current_month += 1
    st.success("Month Simulation Complete!")

# --- DASHBOARD UI ---

st.title("📊 HFC Network Simulator")
st.markdown("**Logic:** Uneven recruiting + Strict Sponsor-Relative Placement.")

# 1. KPI ROW
if sys.history:
    last = sys.history[-1]
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Total Members", f"{last['Members']:,}")
    k2.metric("Monthly Revenue", f"${last['Revenue']:,.0f}")
    k3.metric("Total Payout", f"${last['Payout']:,.0f}")
    k4.metric("Platform Margin (on CV)", f"${last['Margin']:,.0f}")

# 2. CHARTS
col_chart1, col_chart2 = st.columns(2)

if sys.history:
    df_hist = pd.DataFrame(sys.history)
    
    with col_chart1:
        st.subheader("Growth & Revenue")
        chart = alt.Chart(df_hist).mark_line(point=True).encode(
            x='Month:O',
            y='Revenue:Q',
            tooltip=['Month', 'Revenue', 'Members']
        ).interactive()
        st.altair_chart(chart, use_container_width=True)
        
    with col_chart2:
        st.subheader("Payout vs Margin")
        df_melt = df_hist.melt('Month', value_vars=['Payout', 'Margin'], var_name='Type', value_name='Amount')
        chart2 = alt.Chart(df_melt).mark_bar().encode(
            x='Month:O',
            y='Amount:Q',
            color='Type:N',
            tooltip=['Month', 'Type', 'Amount']
        )
        st.altair_chart(chart2, use_container_width=True)

# 3. UNEVEN TREE ANALYSIS
st.divider()
st.subheader("🔍 Uneven Tree Verification")

tab1, tab2 = st.tabs(["🏆 Top Earners", "🕷️ Specific User Lookup"])

with tab1:
    all_users = list(sys.users.values())
    all_users.sort(key=lambda x: sum(x.wallet.values()), reverse=True)
    
    top_data = []
    for u in all_users[:10]:
        top_data.append({
            "User ID": u.id,
            "Package": u.package,
            "Total Earned": f"${sum(u.wallet.values()):,.2f}",
            "Passive": f"${u.wallet['passive']:,.2f}",
            "Direct": f"${u.wallet['direct']:,.2f}"
        })
    st.table(pd.DataFrame(top_data))

with tab2:
    st.write("Enter an ID to see their Binary Tree size. Compare a 'Leader' to a 'Passive' user.")
    uid_input = st.text_input("Enter User ID (e.g., u1a, u50a)", "u1a")
    
    if uid_input in sys.users:
        u = sys.users[uid_input]
        
        # Calculate Subtree Size
        q = collections.deque([u.id])
        count = 0
        while q:
            c = sys.users[q.popleft()]
            if c.binary_left: 
                q.append(c.binary_left)
                count += 1
            if c.binary_right: 
                q.append(c.binary_right)
                count += 1
        
        c1, c2, c3 = st.columns(3)
        c1.metric("Package", u.package)
        c2.metric("Binary Team Size", count)
        c3.metric("Passive Earnings", f"${u.wallet['passive']:,.2f}")
    else:
        st.error("User not found.")
