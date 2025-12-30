import streamlit as st
import pandas as pd
import random

# ==========================================
# 📘 1. THE HFC-DYNAMIC PROTOCOL (Backend Logic)
# ==========================================

class CommissionEngine:
    """The HFC-Dynamic Protocol: Handles all commission mathematics."""
    
    COMM_SELF = 0.10     # 10% of CV
    COMM_DIRECT = 0.15   # 15% of CV
    COMM_POOL = 0.50     # 50% of CV
    
    # Package Rules (Cap & Min Depth)
    PACKAGE_RULES = {
        100: {"cap": 1024, "min_depth": 10},
        250: {"cap": 32768, "min_depth": 15},
        500: {"cap": 1048576, "min_depth": 20}
    }

    @staticmethod
    def calculate_commissions(platform, buyer_id, cv_amount):
        buyer = platform.users[buyer_id]
        logs = []
        
        # 1. SELF COMMISSION
        self_comm = cv_amount * CommissionEngine.COMM_SELF
        buyer.wallet['self'] += self_comm
        logs.append(f"💰 {buyer.name} earned ${self_comm:.2f} Cashback")
        
        # 2. DIRECT COMMISSION
        if buyer.sponsor_id and buyer.sponsor_id in platform.users:
            sponsor = platform.users[buyer.sponsor_id]
            direct_comm = cv_amount * CommissionEngine.COMM_DIRECT
            sponsor.wallet['direct'] += direct_comm
            logs.append(f"💰 Sponsor {sponsor.name} earned ${direct_comm:.2f} Direct Comm")
            
        # 3. PASSIVE COMMISSION (Top-Down Binary Traversal)
        curr = buyer
        depth = 0
        
        # Climb the binary tree
        while curr.binary_parent:
            parent = platform.users[curr.binary_parent]
            depth += 1
            
            # Get Rules for Parent's Package
            rule = CommissionEngine.PACKAGE_RULES.get(parent.package, CommissionEngine.PACKAGE_RULES[100])
            
            # THE HFC FORMULA: Divisor = Max(Actual_Depth, Min_Depth)
            divisor = max(depth, rule['min_depth'])
            
            passive_payout = (cv_amount * CommissionEngine.COMM_POOL) / divisor
            parent.wallet['passive'] += passive_payout
            
            # Only log major payouts to keep UI clean
            if passive_payout > 0.01:
                pass # Backend calculation happening silently
                
            curr = parent
            
        return logs

# ==========================================
# 🏗️ 2. DATA MODELS (Database Simulation)
# ==========================================

class User:
    def __init__(self, uid, name, package, sponsor_id=None):
        self.id = uid
        self.name = name
        self.package = package
        self.sponsor_id = sponsor_id
        self.binary_parent = None
        self.binary_left = None
        self.binary_right = None
        self.wallet = {'self': 0.0, 'direct': 0.0, 'passive': 0.0}

    def total_earnings(self):
        return sum(self.wallet.values())

class Product:
    def __init__(self, name, price, cv_percent, vendor):
        self.name = name
        self.price = price
        self.cv_percent = cv_percent
        self.vendor = vendor
    
    @property
    def cv(self):
        return self.price * (self.cv_percent / 100.0)

class Platform:
    def __init__(self):
        self.users = {}
        self.products = []
        self.binary_queue = [] # Simple list for queue
        self.user_counter = 1
        
        # Init Root User
        self.register_user("AdminRoot", 500, None)
        
        # Init Default Products
        self.add_product("Eco-Book", 20.0, 40, "Vendor A")
        self.add_product("Marketing Course", 100.0, 50, "Vendor B")
        
    def add_product(self, name, price, cv_percent, vendor):
        self.products.append(Product(name, price, cv_percent, vendor))

    def register_user(self, name, package, sponsor_id):
        uid = f"u{self.user_counter}"
        self.user_counter += 1
        new_user = User(uid, name, package, sponsor_id)
        self.users[uid] = new_user
        
        # Binary Placement (Simple Queue Spillover)
        if uid == "u1":
            self.binary_queue.append(uid)
        else:
            # Find first available parent
            for potential_parent_id in self.binary_queue:
                parent = self.users[potential_parent_id]
                if parent.binary_left is None:
                    parent.binary_left = uid
                    new_user.binary_parent = potential_parent_id
                    self.binary_queue.append(uid)
                    break
                elif parent.binary_right is None:
                    parent.binary_right = uid
                    new_user.binary_parent = potential_parent_id
                    self.binary_queue.append(uid)
                    break
        return new_user

# ==========================================
# 🖥️ 3. FRONTEND INTERFACE (Streamlit)
# ==========================================

# Initialize Session State (Persist Data)
if 'platform' not in st.session_state:
    st.session_state.platform = Platform()
    # Create some dummy users for demo
    st.session_state.platform.register_user("Alice (Leader)", 250, "u1")
    st.session_state.platform.register_user("Bob (Affiliate)", 100, "u2")

sys = st.session_state.platform

# --- APP LAYOUT ---
st.set_page_config(page_title="HFC Platform MVP", layout="wide")
st.title("🌐 Holistic Financial Cycle (HFC) Platform")
st.markdown("### Powered by HFC-Dynamic Protocol")

# Sidebar Navigation
menu = st.sidebar.radio("Navigation", ["🛒 Marketplace (Customer)", "💼 Vendor Portal", "📈 Affiliate Dashboard", "⚙️ Admin View"])

# --- 1. MARKETPLACE ---
if menu == "🛒 Marketplace (Customer)":
    st.header("Shop & Earn Cashback")
    
    # Login Simulator
    st.sidebar.markdown("---")
    current_user = st.sidebar.selectbox("Simulate Logged In User", [u.name for u in sys.users.values()])
    user_obj = [u for u in sys.users.values() if u.name == current_user][0]
    
    # Display Products
    cols = st.columns(3)
    for i, prod in enumerate(sys.products):
        with cols[i % 3]:
            with st.container(border=True):
                st.subheader(prod.name)
                st.write(f"**Price: ${prod.price}**")
                st.caption(f"Vendor: {prod.vendor}")
                st.info(f"⚡ Commissionable Value: ${prod.cv:.2f}")
                
                if st.button(f"Buy {prod.name}", key=f"buy_{i}"):
                    logs = CommissionEngine.calculate_commissions(sys, user_obj.id, prod.cv)
                    st.success(f"Purchased {prod.name}!")
                    for log in logs:
                        st.write(log)

# --- 2. VENDOR PORTAL ---
elif menu == "💼 Vendor Portal":
    st.header("Vendor Listing Portal")
    
    with st.form("add_product"):
        st.write("List a new product on the platform.")
        col1, col2 = st.columns(2)
        p_name = col1.text_input("Product Name")
        p_vendor = col2.text_input("Vendor Name", value="My Company")
        p_price = col1.number_input("Sale Price ($)", min_value=1.0, value=50.0)
        p_cv = col2.slider("Commission Share (%) - 'The CV'", 5, 100, 40)
        
        if st.form_submit_button("List Product"):
            sys.add_product(p_name, p_price, p_cv, p_vendor)
            st.success(f"✅ {p_name} listed! Affiliates will earn on ${p_price * (p_cv/100):.2f} CV.")

# --- 3. AFFILIATE DASHBOARD ---
elif menu == "📈 Affiliate Dashboard":
    st.header("Affiliate Workspace")
    
    # User Selector
    selected_name = st.selectbox("Select Affiliate Account", [u.name for u in sys.users.values()])
    user = [u for u in sys.users.values() if u.name == selected_name][0]
    
    # Metrics
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Package Tier", f"${user.package}")
    m2.metric("Total Earnings", f"${user.total_earnings():,.2f}")
    m3.metric("Sponsor ID", user.sponsor_id if user.sponsor_id else "Root")
    m4.metric("User ID", user.id)
    
    st.divider()
    
    # Wallet Breakdown
    st.subheader("💰 Wallet Breakdown")
    w1, w2, w3 = st.columns(3)
    w1.info(f"**Cashback (Self):**\n\n${user.wallet['self']:,.2f}")
    w2.warning(f"**Direct Comm:**\n\n${user.wallet['direct']:,.2f}")
    w3.success(f"**Passive Pool:**\n\n${user.wallet['passive']:,.2f}")
    
    st.divider()
    
    # Recruitment Tool
    st.subheader("🔗 Recruit New Member")
    with st.form("recruit"):
        new_name = st.text_input("New Member Name")
        new_pkg = st.selectbox("Assign Package", [100, 250, 500])
        if st.form_submit_button("Register Downline"):
            new_u = sys.register_user(new_name, new_pkg, user.id)
            st.success(f"Registered {new_name} (ID: {new_u.id}) under {user.name}!")
            st.rerun()

# --- 4. ADMIN VIEW ---
elif menu == "⚙️ Admin View":
    st.header("Global Platform Stats")
    
    # Dataframe of Users
    data = []
    for u in sys.users.values():
        data.append({
            "ID": u.id,
            "Name": u.name,
            "Package": u.package,
            "Total Earned": f"${u.total_earnings():.2f}",
            "Sponsor": u.sponsor_id,
            "Parent": u.binary_parent
        })
    st.dataframe(pd.DataFrame(data))
    
    st.subheader("Product Catalog")
    p_data = [{"Product": p.name, "Price": p.price, "CV %": p.cv_percent, "CV $": p.cv} for p in sys.products]
    st.table(pd.DataFrame(p_data))
