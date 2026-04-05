from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from secrets import token_hex

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models import (
    Branch,
    Category,
    Floor,
    Order,
    OrderItem,
    POSSession,
    POSTerminal,
    Payment,
    PaymentMethod,
    Product,
    ProductVariant,
    ProductVariantValue,
    RestaurantTable,
    SelfOrderToken,
    User,
)


def seed_database(db: Session) -> None:
    if db.query(Category).first() or db.query(Order).first():
        return

    now = datetime.utcnow()

    branches = {
        "main": _get_or_create_branch(db, name="Main Branch", code="MAIN", address="MG Road, Bengaluru", phone="+91-9876543210"),
        "downtown": _get_or_create_branch(db, name="Downtown Branch", code="DTWN", address="Church Street, Bengaluru", phone="+91-9876543211"),
        "airport": _get_or_create_branch(db, name="Airport Branch", code="AIR", address="Airport Road, Bengaluru", phone="+91-9876543212"),
    }
    db.flush()

    staff = {
        "main_1": _get_or_create_user(db, name="Riya Sharma", username="mainstaff", email="riya.main@poscafe.local", password="staff123", role="staff", branch_id=branches["main"].id),
        "main_2": _get_or_create_user(db, name="Karan Verma", username="mainstaff2", email="karan.main@poscafe.local", password="staff123", role="staff", branch_id=branches["main"].id),
        "main_3": _get_or_create_user(db, name="Aditi Nair", username="mainstaff3", email="aditi.main@poscafe.local", password="staff123", role="staff", branch_id=branches["main"].id),
        "downtown_1": _get_or_create_user(db, name="Arjun Mehta", username="downtownstaff", email="arjun.downtown@poscafe.local", password="staff123", role="staff", branch_id=branches["downtown"].id),
        "downtown_2": _get_or_create_user(db, name="Ishita Rao", username="downtownstaff2", email="ishita.downtown@poscafe.local", password="staff123", role="staff", branch_id=branches["downtown"].id),
        "downtown_3": _get_or_create_user(db, name="Varun Sethi", username="downtownstaff3", email="varun.downtown@poscafe.local", password="staff123", role="staff", branch_id=branches["downtown"].id),
        "airport_1": _get_or_create_user(db, name="Sneha Iyer", username="airportstaff", email="sneha.airport@poscafe.local", password="staff123", role="staff", branch_id=branches["airport"].id),
        "airport_2": _get_or_create_user(db, name="Rahul Jain", username="airportstaff2", email="rahul.airport@poscafe.local", password="staff123", role="staff", branch_id=branches["airport"].id),
    }
    _get_or_create_user(db, name="System Admin", username="admin", email="admin@poscafe.local", password="admin123", role="admin", branch_id=None)
    _get_or_create_user(db, name="Chef Neha", username="mainchef", email="chef.main@poscafe.local", password="chef123", role="chef", branch_id=branches["main"].id)
    _get_or_create_user(db, name="Chef Kabir", username="downtownchef", email="chef.downtown@poscafe.local", password="chef123", role="chef", branch_id=branches["downtown"].id)
    _get_or_create_user(db, name="Chef Aman", username="airportchef", email="chef.airport@poscafe.local", password="chef123", role="chef", branch_id=branches["airport"].id)
    db.flush()

    categories = {
        "Starters": Category(name="Starters", is_active=True),
        "Mains": Category(name="Mains", is_active=True),
        "Beverages": Category(name="Beverages", is_active=True),
        "Desserts": Category(name="Desserts", is_active=True),
    }
    db.add_all(categories.values())
    db.flush()

    payment_methods = [
        PaymentMethod(name="Cash", type="cash", enabled=True, config_json={}, is_active=True),
        PaymentMethod(name="Card", type="card", enabled=True, config_json={}, is_active=True),
        PaymentMethod(name="UPI", type="upi", enabled=True, config_json={"upi_id": "cafedemo@upi"}, is_active=True),
    ]
    db.add_all(payment_methods)
    db.flush()

    products: dict[str, Product] = {}

    products["main_paneer_tikka"] = _create_product(
        db, branch_id=branches["main"].id, category_id=categories["Starters"].id,
        name="Paneer Tikka", description="Smoky paneer cubes with mint chutney.", price="260.00", unit="plate", tax_rate=5
    )
    products["main_farmhouse_pizza"] = _create_product(
        db, branch_id=branches["main"].id, category_id=categories["Mains"].id,
        name="Farmhouse Pizza", description="Loaded veg pizza with mozzarella and herbs.", price="420.00", unit="pizza", tax_rate=5,
        variants=[("Size", [("Regular", "0.00"), ("Large", "140.00")])]
    )
    products["main_masala_lemonade"] = _create_product(
        db, branch_id=branches["main"].id, category_id=categories["Beverages"].id,
        name="Masala Lemonade", description="Fresh lemonade with house masala.", price="110.00", unit="glass", tax_rate=5, send_to_kitchen=False
    )
    products["main_cold_coffee"] = _create_product(
        db, branch_id=branches["main"].id, category_id=categories["Beverages"].id,
        name="Cold Coffee", description="Chilled coffee with whipped cream.", price="150.00", unit="glass", tax_rate=5, send_to_kitchen=False,
        variants=[("Add-on", [("Vanilla", "20.00"), ("Hazelnut", "25.00")])]
    )
    products["main_brownie"] = _create_product(
        db, branch_id=branches["main"].id, category_id=categories["Desserts"].id,
        name="Brownie Sundae", description="Warm brownie served with vanilla ice cream.", price="220.00", unit="serve", tax_rate=5
    )
    products["main_caesar_salad"] = _create_product(
        db, branch_id=branches["main"].id, category_id=categories["Starters"].id,
        name="Caesar Salad", description="Crisp lettuce, croutons, and creamy dressing.", price="210.00", unit="bowl", tax_rate=5
    )
    products["main_hara_bhara"] = _create_product(
        db, branch_id=branches["main"].id, category_id=categories["Starters"].id,
        name="Hara Bhara Kebab", description="Spinach and pea kebabs with herb dip.", price="230.00", unit="plate", tax_rate=5
    )
    products["main_pesto_pasta"] = _create_product(
        db, branch_id=branches["main"].id, category_id=categories["Mains"].id,
        name="Pesto Pasta", description="Basil pesto pasta with parmesan flakes.", price="360.00", unit="bowl", tax_rate=5
    )
    products["main_sizzler"] = _create_product(
        db, branch_id=branches["main"].id, category_id=categories["Mains"].id,
        name="Veg Sizzler", description="Hot iron platter with veggies and rice.", price="490.00", unit="plate", tax_rate=5
    )
    products["main_tiramisu"] = _create_product(
        db, branch_id=branches["main"].id, category_id=categories["Desserts"].id,
        name="Tiramisu Jar", description="Coffee layered mascarpone dessert jar.", price="260.00", unit="jar", tax_rate=5
    )

    products["downtown_bruschetta"] = _create_product(
        db, branch_id=branches["downtown"].id, category_id=categories["Starters"].id,
        name="Bruschetta", description="Toasted artisan bread with tomato basil topping.", price="180.00", unit="plate", tax_rate=5
    )
    products["downtown_penne"] = _create_product(
        db, branch_id=branches["downtown"].id, category_id=categories["Mains"].id,
        name="Penne Alfredo", description="Creamy white sauce pasta with parmesan.", price="340.00", unit="bowl", tax_rate=5
    )
    products["downtown_tandoori"] = _create_product(
        db, branch_id=branches["downtown"].id, category_id=categories["Mains"].id,
        name="Tandoori Platter", description="Mixed tandoori platter for sharing.", price="560.00", unit="platter", tax_rate=5
    )
    products["downtown_fresh_lime"] = _create_product(
        db, branch_id=branches["downtown"].id, category_id=categories["Beverages"].id,
        name="Fresh Lime Soda", description="Sweet and salted soda with lime.", price="120.00", unit="glass", tax_rate=5, send_to_kitchen=False
    )
    products["downtown_cheesecake"] = _create_product(
        db, branch_id=branches["downtown"].id, category_id=categories["Desserts"].id,
        name="Cheesecake", description="New York style cheesecake slice.", price="240.00", unit="slice", tax_rate=5
    )
    products["downtown_stuffed_mushroom"] = _create_product(
        db, branch_id=branches["downtown"].id, category_id=categories["Starters"].id,
        name="Stuffed Mushroom", description="Cheese stuffed mushrooms baked golden.", price="250.00", unit="plate", tax_rate=5
    )
    products["downtown_lasagna"] = _create_product(
        db, branch_id=branches["downtown"].id, category_id=categories["Mains"].id,
        name="Veg Lasagna", description="Layered baked lasagna with rich tomato sauce.", price="410.00", unit="portion", tax_rate=5
    )
    products["downtown_mojito"] = _create_product(
        db, branch_id=branches["downtown"].id, category_id=categories["Beverages"].id,
        name="Virgin Mojito", description="Mint and lime cooler.", price="160.00", unit="glass", tax_rate=5, send_to_kitchen=False
    )

    products["airport_veg_burger"] = _create_product(
        db, branch_id=branches["airport"].id, category_id=categories["Mains"].id,
        name="Veg Burger", description="Loaded burger with fries on the side.", price="280.00", unit="plate", tax_rate=5,
        variants=[("Add-on", [("Extra Cheese", "30.00"), ("Double Patty", "70.00")])]
    )
    products["airport_masala_chai"] = _create_product(
        db, branch_id=branches["airport"].id, category_id=categories["Beverages"].id,
        name="Masala Chai", description="Hot spiced tea.", price="90.00", unit="cup", tax_rate=5, send_to_kitchen=False
    )
    products["airport_wrap"] = _create_product(
        db, branch_id=branches["airport"].id, category_id=categories["Mains"].id,
        name="Airport Veg Wrap", description="Quick grilled wrap for travelers.", price="230.00", unit="piece", tax_rate=5
    )
    products["airport_hash_brown"] = _create_product(
        db, branch_id=branches["airport"].id, category_id=categories["Starters"].id,
        name="Hash Brown Basket", description="Crispy potato bites for grab-and-go orders.", price="170.00", unit="basket", tax_rate=5
    )
    products["airport_espresso"] = _create_product(
        db, branch_id=branches["airport"].id, category_id=categories["Beverages"].id,
        name="Double Espresso", description="Strong quick coffee shot.", price="130.00", unit="cup", tax_rate=5, send_to_kitchen=False
    )
    products["airport_muffin"] = _create_product(
        db, branch_id=branches["airport"].id, category_id=categories["Desserts"].id,
        name="Blueberry Muffin", description="Fresh baked blueberry muffin.", price="145.00", unit="piece", tax_rate=5
    )
    db.flush()

    floors = {
        "main_ground": Floor(branch_id=branches["main"].id, name="Ground Floor", is_active=True),
        "main_rooftop": Floor(branch_id=branches["main"].id, name="Rooftop", is_active=True),
        "main_lounge": Floor(branch_id=branches["main"].id, name="Private Lounge", is_active=True),
        "main_garden": Floor(branch_id=branches["main"].id, name="Garden Deck", is_active=True),
        "downtown_main": Floor(branch_id=branches["downtown"].id, name="Main Dining", is_active=True),
        "downtown_family": Floor(branch_id=branches["downtown"].id, name="Family Section", is_active=True),
        "downtown_upper": Floor(branch_id=branches["downtown"].id, name="Upper Loft", is_active=True),
        "airport_express": Floor(branch_id=branches["airport"].id, name="Express Hall", is_active=True),
        "airport_waiting": Floor(branch_id=branches["airport"].id, name="Waiting Lounge", is_active=True),
    }
    db.add_all(floors.values())
    db.flush()

    tables = {
        "main_t1": RestaurantTable(branch_id=branches["main"].id, floor_id=floors["main_ground"].id, table_number="T1", seats=2, active=True),
        "main_t2": RestaurantTable(branch_id=branches["main"].id, floor_id=floors["main_ground"].id, table_number="T2", seats=4, active=True),
        "main_t3": RestaurantTable(branch_id=branches["main"].id, floor_id=floors["main_ground"].id, table_number="T3", seats=6, active=True),
        "main_t4": RestaurantTable(branch_id=branches["main"].id, floor_id=floors["main_ground"].id, table_number="T4", seats=2, active=True),
        "main_r1": RestaurantTable(branch_id=branches["main"].id, floor_id=floors["main_rooftop"].id, table_number="R1", seats=4, active=True),
        "main_r2": RestaurantTable(branch_id=branches["main"].id, floor_id=floors["main_rooftop"].id, table_number="R2", seats=6, active=True),
        "main_l1": RestaurantTable(branch_id=branches["main"].id, floor_id=floors["main_lounge"].id, table_number="L1", seats=8, active=True),
        "main_g1": RestaurantTable(branch_id=branches["main"].id, floor_id=floors["main_garden"].id, table_number="G1", seats=4, active=True),
        "downtown_d1": RestaurantTable(branch_id=branches["downtown"].id, floor_id=floors["downtown_main"].id, table_number="D1", seats=2, active=True),
        "downtown_d2": RestaurantTable(branch_id=branches["downtown"].id, floor_id=floors["downtown_main"].id, table_number="D2", seats=6, active=True),
        "downtown_d3": RestaurantTable(branch_id=branches["downtown"].id, floor_id=floors["downtown_main"].id, table_number="D3", seats=4, active=True),
        "downtown_f1": RestaurantTable(branch_id=branches["downtown"].id, floor_id=floors["downtown_family"].id, table_number="F1", seats=4, active=True),
        "downtown_f2": RestaurantTable(branch_id=branches["downtown"].id, floor_id=floors["downtown_family"].id, table_number="F2", seats=8, active=True),
        "downtown_u1": RestaurantTable(branch_id=branches["downtown"].id, floor_id=floors["downtown_upper"].id, table_number="U1", seats=4, active=True),
        "airport_e1": RestaurantTable(branch_id=branches["airport"].id, floor_id=floors["airport_express"].id, table_number="E1", seats=2, active=True),
        "airport_e2": RestaurantTable(branch_id=branches["airport"].id, floor_id=floors["airport_express"].id, table_number="E2", seats=2, active=True),
        "airport_e3": RestaurantTable(branch_id=branches["airport"].id, floor_id=floors["airport_express"].id, table_number="E3", seats=2, active=True),
        "airport_w1": RestaurantTable(branch_id=branches["airport"].id, floor_id=floors["airport_waiting"].id, table_number="W1", seats=4, active=True),
    }
    db.add_all(tables.values())
    db.flush()

    terminals = {
        "main_register": POSTerminal(branch_id=branches["main"].id, name="Main Register", location="Ground Floor", active=True),
        "main_rooftop_register": POSTerminal(branch_id=branches["main"].id, name="Rooftop Register", location="Rooftop", active=True),
        "downtown_register": POSTerminal(branch_id=branches["downtown"].id, name="Downtown Register", location="Front Desk", active=True),
        "downtown_upper_register": POSTerminal(branch_id=branches["downtown"].id, name="Upper Loft Register", location="Upper Loft", active=True),
        "airport_register": POSTerminal(branch_id=branches["airport"].id, name="Airport Register", location="Express Hall", active=True),
    }
    db.add_all(terminals.values())
    db.flush()

    sessions = {
        "main_open": POSSession(branch_id=branches["main"].id, terminal_id=terminals["main_register"].id, responsible_id=staff["main_1"].id, status="open", opening_amount=Decimal("3000.00"), closing_amount=Decimal("0.00"), opened_at=now - timedelta(hours=4)),
        "main_closed": POSSession(branch_id=branches["main"].id, terminal_id=terminals["main_rooftop_register"].id, responsible_id=staff["main_2"].id, status="closed", opening_amount=Decimal("2500.00"), closing_amount=Decimal("6150.00"), opened_at=now - timedelta(days=1, hours=6), closed_at=now - timedelta(days=1, hours=1)),
        "downtown_open": POSSession(branch_id=branches["downtown"].id, terminal_id=terminals["downtown_register"].id, responsible_id=staff["downtown_1"].id, status="open", opening_amount=Decimal("2200.00"), closing_amount=Decimal("0.00"), opened_at=now - timedelta(hours=3)),
        "downtown_closed": POSSession(branch_id=branches["downtown"].id, terminal_id=terminals["downtown_upper_register"].id, responsible_id=staff["downtown_3"].id, status="closed", opening_amount=Decimal("1900.00"), closing_amount=Decimal("5420.00"), opened_at=now - timedelta(days=1, hours=5), closed_at=now - timedelta(days=1, hours=1)),
        "airport_open": POSSession(branch_id=branches["airport"].id, terminal_id=terminals["airport_register"].id, responsible_id=staff["airport_1"].id, status="open", opening_amount=Decimal("3500.00"), closing_amount=Decimal("0.00"), opened_at=now - timedelta(hours=2, minutes=30)),
        "airport_closed": POSSession(branch_id=branches["airport"].id, terminal_id=terminals["airport_register"].id, responsible_id=staff["airport_2"].id, status="closed", opening_amount=Decimal("2800.00"), closing_amount=Decimal("4680.00"), opened_at=now - timedelta(days=2, hours=4), closed_at=now - timedelta(days=2, hours=1)),
    }
    db.add_all(sessions.values())
    db.flush()

    order_main_paid = _build_order(
        branch_id=branches["main"].id,
        session_id=sessions["main_open"].id,
        table_id=tables["main_t1"].id,
        responsible_id=staff["main_1"].id,
        order_number="ORD-MAIN-001",
        order_type="pos",
        status="completed",
        kitchen_status="completed",
        payment_status="paid",
        notes="Less spicy",
        created_at=now - timedelta(hours=2, minutes=20),
        closed_at=now - timedelta(hours=2),
        paid_at=now - timedelta(hours=2),
        items=[
            {"product": products["main_paneer_tikka"], "quantity": 1},
            {"product": products["main_farmhouse_pizza"], "quantity": 1, "variant_label": "Large"},
            {"product": products["main_masala_lemonade"], "quantity": 2},
        ],
    )
    db.add(order_main_paid)
    db.flush()
    db.add(Payment(order_id=order_main_paid.id, payment_method_id=payment_methods[0].id, amount=order_main_paid.grand_total, payment_status="confirmed", transaction_ref="CASH-DEMO-001", reference="CASH-DEMO-001", paid_at=order_main_paid.paid_at, created_at=order_main_paid.created_at, updated_at=order_main_paid.closed_at or order_main_paid.created_at))

    db.add(
        _build_order(
            branch_id=branches["main"].id,
            session_id=sessions["main_open"].id,
            table_id=tables["main_t2"].id,
            responsible_id=staff["main_1"].id,
            order_number="ORD-MAIN-002",
            order_type="self",
            status="sent",
            kitchen_status="preparing",
            payment_status="unpaid",
            notes="Customer self order",
            created_at=now - timedelta(minutes=40),
            items=[
                {"product": products["main_caesar_salad"], "quantity": 1},
                {"product": products["main_cold_coffee"], "quantity": 2, "variant_label": "Vanilla"},
                {"product": products["main_brownie"], "quantity": 1},
            ],
        )
    )
    db.add(
        _build_order(
            branch_id=branches["main"].id,
            session_id=sessions["main_open"].id,
            table_id=tables["main_r1"].id,
            responsible_id=staff["main_2"].id,
            order_number="ORD-MAIN-003",
            order_type="pos",
            status="sent",
            kitchen_status="to_cook",
            payment_status="unpaid",
            notes="Rooftop group order",
            created_at=now - timedelta(minutes=55),
            items=[
                {"product": products["main_pesto_pasta"], "quantity": 2},
                {"product": products["main_sizzler"], "quantity": 1},
                {"product": products["main_tiramisu"], "quantity": 2},
            ],
        )
    )
    order_main_paid_two = _build_order(
        branch_id=branches["main"].id,
        session_id=sessions["main_closed"].id,
        table_id=tables["main_g1"].id,
        responsible_id=staff["main_3"].id,
        order_number="ORD-MAIN-004",
        order_type="pos",
        status="completed",
        kitchen_status="completed",
        payment_status="paid",
        notes="Garden evening service",
        created_at=now - timedelta(days=1, hours=3),
        closed_at=now - timedelta(days=1, hours=2, minutes=30),
        paid_at=now - timedelta(days=1, hours=2, minutes=30),
        items=[
            {"product": products["main_hara_bhara"], "quantity": 2},
            {"product": products["main_farmhouse_pizza"], "quantity": 1, "variant_label": "Regular"},
            {"product": products["main_masala_lemonade"], "quantity": 3},
        ],
    )
    db.add(order_main_paid_two)
    db.flush()
    db.add(Payment(order_id=order_main_paid_two.id, payment_method_id=payment_methods[1].id, amount=order_main_paid_two.grand_total, payment_status="confirmed", transaction_ref="CARD-DEMO-002", reference="CARD-DEMO-002", paid_at=order_main_paid_two.paid_at, created_at=order_main_paid_two.created_at, updated_at=order_main_paid_two.closed_at or order_main_paid_two.created_at))

    order_downtown_paid = _build_order(
        branch_id=branches["downtown"].id,
        session_id=sessions["downtown_open"].id,
        table_id=tables["downtown_d2"].id,
        responsible_id=staff["downtown_1"].id,
        order_number="ORD-DTWN-001",
        order_type="pos",
        status="completed",
        kitchen_status="completed",
        payment_status="paid",
        notes="Family dinner",
        created_at=now - timedelta(hours=1, minutes=15),
        closed_at=now - timedelta(hours=1),
        paid_at=now - timedelta(hours=1),
        items=[
            {"product": products["downtown_tandoori"], "quantity": 1},
            {"product": products["downtown_fresh_lime"], "quantity": 3},
            {"product": products["downtown_cheesecake"], "quantity": 2},
        ],
    )
    db.add(order_downtown_paid)
    db.flush()
    db.add(Payment(order_id=order_downtown_paid.id, payment_method_id=payment_methods[2].id, amount=order_downtown_paid.grand_total, payment_status="confirmed", transaction_ref="UPI-DEMO-004", reference="UPI-DEMO-004", paid_at=order_downtown_paid.paid_at, created_at=order_downtown_paid.created_at, updated_at=order_downtown_paid.closed_at or order_downtown_paid.created_at))

    db.add(
        _build_order(
            branch_id=branches["downtown"].id,
            session_id=sessions["downtown_open"].id,
            table_id=tables["downtown_d1"].id,
            responsible_id=staff["downtown_1"].id,
            order_number="ORD-DTWN-002",
            order_type="pos",
            status="sent",
            kitchen_status="to_cook",
            payment_status="unpaid",
            notes="Window table",
            created_at=now - timedelta(minutes=25),
            items=[
                {"product": products["downtown_bruschetta"], "quantity": 1},
                {"product": products["downtown_penne"], "quantity": 2},
            ],
        )
    )
    db.add(
        _build_order(
            branch_id=branches["downtown"].id,
            session_id=sessions["downtown_open"].id,
            table_id=tables["downtown_f1"].id,
            responsible_id=staff["downtown_2"].id,
            order_number="ORD-DTWN-003",
            order_type="pos",
            status="sent",
            kitchen_status="preparing",
            payment_status="unpaid",
            notes="Birthday table",
            created_at=now - timedelta(minutes=38),
            items=[
                {"product": products["downtown_stuffed_mushroom"], "quantity": 1},
                {"product": products["downtown_lasagna"], "quantity": 2},
                {"product": products["downtown_mojito"], "quantity": 3},
            ],
        )
    )
    order_downtown_paid_two = _build_order(
        branch_id=branches["downtown"].id,
        session_id=sessions["downtown_closed"].id,
        table_id=tables["downtown_u1"].id,
        responsible_id=staff["downtown_3"].id,
        order_number="ORD-DTWN-004",
        order_type="pos",
        status="completed",
        kitchen_status="completed",
        payment_status="paid",
        notes="Late dinner loft seating",
        created_at=now - timedelta(days=1, hours=2, minutes=20),
        closed_at=now - timedelta(days=1, hours=1, minutes=50),
        paid_at=now - timedelta(days=1, hours=1, minutes=50),
        items=[
            {"product": products["downtown_bruschetta"], "quantity": 2},
            {"product": products["downtown_tandoori"], "quantity": 1},
            {"product": products["downtown_cheesecake"], "quantity": 1},
        ],
    )
    db.add(order_downtown_paid_two)
    db.flush()
    db.add(Payment(order_id=order_downtown_paid_two.id, payment_method_id=payment_methods[0].id, amount=order_downtown_paid_two.grand_total, payment_status="confirmed", transaction_ref="CASH-DEMO-005", reference="CASH-DEMO-005", paid_at=order_downtown_paid_two.paid_at, created_at=order_downtown_paid_two.created_at, updated_at=order_downtown_paid_two.closed_at or order_downtown_paid_two.created_at))

    db.add(
        _build_order(
            branch_id=branches["airport"].id,
            session_id=sessions["airport_open"].id,
            table_id=tables["airport_e1"].id,
            responsible_id=staff["airport_1"].id,
            order_number="ORD-AIR-001",
            order_type="self",
            status="sent",
            kitchen_status="to_cook",
            payment_status="unpaid",
            notes="Quick bite before boarding",
            created_at=now - timedelta(minutes=18),
            items=[
                {"product": products["airport_veg_burger"], "quantity": 2, "variant_label": "Extra Cheese"},
                {"product": products["airport_masala_chai"], "quantity": 2},
            ],
        )
    )

    db.add(
        _build_order(
            branch_id=branches["airport"].id,
            session_id=sessions["airport_open"].id,
            table_id=tables["airport_e2"].id,
            responsible_id=staff["airport_1"].id,
            order_number="ORD-AIR-002",
            order_type="pos",
            status="sent",
            kitchen_status="preparing",
            payment_status="unpaid",
            notes="Gate-side takeaway",
            created_at=now - timedelta(minutes=12),
            items=[
                {"product": products["airport_wrap"], "quantity": 1},
                {"product": products["airport_masala_chai"], "quantity": 1},
            ],
        )
    )
    db.add(
        _build_order(
            branch_id=branches["airport"].id,
            session_id=sessions["airport_open"].id,
            table_id=tables["airport_w1"].id,
            responsible_id=staff["airport_2"].id,
            order_number="ORD-AIR-003",
            order_type="pos",
            status="sent",
            kitchen_status="to_cook",
            payment_status="unpaid",
            notes="Waiting lounge family",
            created_at=now - timedelta(minutes=30),
            items=[
                {"product": products["airport_hash_brown"], "quantity": 2},
                {"product": products["airport_wrap"], "quantity": 2},
                {"product": products["airport_espresso"], "quantity": 2},
            ],
        )
    )
    order_airport_paid = _build_order(
        branch_id=branches["airport"].id,
        session_id=sessions["airport_closed"].id,
        table_id=tables["airport_e3"].id,
        responsible_id=staff["airport_2"].id,
        order_number="ORD-AIR-004",
        order_type="pos",
        status="completed",
        kitchen_status="completed",
        payment_status="paid",
        notes="Morning traveler rush",
        created_at=now - timedelta(days=2, hours=2),
        closed_at=now - timedelta(days=2, hours=1, minutes=35),
        paid_at=now - timedelta(days=2, hours=1, minutes=35),
        items=[
            {"product": products["airport_hash_brown"], "quantity": 1},
            {"product": products["airport_muffin"], "quantity": 2},
            {"product": products["airport_espresso"], "quantity": 2},
        ],
    )
    db.add(order_airport_paid)
    db.flush()
    db.add(Payment(order_id=order_airport_paid.id, payment_method_id=payment_methods[2].id, amount=order_airport_paid.grand_total, payment_status="confirmed", transaction_ref="UPI-DEMO-006", reference="UPI-DEMO-006", paid_at=order_airport_paid.paid_at, created_at=order_airport_paid.created_at, updated_at=order_airport_paid.closed_at or order_airport_paid.created_at))

    db.flush()

    db.add_all(
        [
            SelfOrderToken(branch_id=branches["main"].id, token=token_hex(6), table_id=tables["main_t2"].id, session_id=sessions["main_open"].id, active=True, expires_at=now + timedelta(hours=6), created_at=now - timedelta(hours=1), updated_at=now - timedelta(hours=1)),
            SelfOrderToken(branch_id=branches["downtown"].id, token=token_hex(6), table_id=tables["downtown_f2"].id, session_id=sessions["downtown_open"].id, active=True, expires_at=now + timedelta(hours=7), created_at=now - timedelta(hours=2), updated_at=now - timedelta(hours=2)),
            SelfOrderToken(branch_id=branches["airport"].id, token=token_hex(6), table_id=tables["airport_e1"].id, session_id=sessions["airport_open"].id, active=True, expires_at=now + timedelta(hours=8), created_at=now - timedelta(minutes=45), updated_at=now - timedelta(minutes=45)),
        ]
    )

    db.commit()


def _get_or_create_user(
    db: Session,
    *,
    name: str,
    username: str,
    email: str,
    password: str,
    role: str,
    branch_id: int | None,
) -> User:
    user = db.query(User).filter((User.username == username) | (User.email == email)).first()
    if user:
        user.name = name
        user.username = username
        user.email = email
        user.role = role
        user.branch_id = branch_id
        user.is_active = True
        if not user.password_hash:
            user.password_hash = hash_password(password)
        return user

    user = User(
        name=name,
        username=username,
        email=email,
        password_hash=hash_password(password),
        role=role,
        branch_id=branch_id,
        is_active=True,
    )
    db.add(user)
    return user


def _get_or_create_branch(
    db: Session,
    *,
    name: str,
    code: str,
    address: str,
    phone: str,
) -> Branch:
    branch = db.query(Branch).filter((Branch.name == name) | (Branch.code == code)).first()
    if branch:
        branch.name = name
        branch.code = code
        branch.address = address
        branch.phone = phone
        branch.is_active = True
        return branch

    branch = Branch(name=name, code=code, address=address, phone=phone, is_active=True)
    db.add(branch)
    db.flush()
    return branch


def _create_product(
    db: Session,
    *,
    branch_id: int,
    category_id: int,
    name: str,
    description: str,
    price: str,
    unit: str,
    tax_rate: float,
    send_to_kitchen: bool = True,
    variants: list[tuple[str, list[tuple[str, str]]]] | None = None,
) -> Product:
    product = Product(
        branch_id=branch_id,
        category_id=category_id,
        name=name,
        description=description,
        base_price=Decimal(price),
        unit=unit,
        tax_rate=tax_rate,
        image_url=None,
        send_to_kitchen=send_to_kitchen,
        is_active=True,
    )
    for variant_name, values in variants or []:
        product.variants_rel.append(
            ProductVariant(
                name=variant_name,
                values=[
                    ProductVariantValue(label=label, extra_price=Decimal(extra_price))
                    for label, extra_price in values
                ],
            )
        )
    db.add(product)
    return product


def _build_order(
    *,
    branch_id: int,
    session_id: int,
    table_id: int | None,
    responsible_id: int,
    order_number: str,
    order_type: str,
    status: str,
    kitchen_status: str,
    payment_status: str,
    notes: str,
    created_at: datetime,
    items: list[dict],
    closed_at: datetime | None = None,
    paid_at: datetime | None = None,
) -> Order:
    subtotal = Decimal("0.00")
    tax_total = Decimal("0.00")
    order = Order(
        branch_id=branch_id,
        session_id=session_id,
        table_id=table_id,
        responsible_id=responsible_id,
        order_number=order_number,
        order_type=order_type,
        status=status,
        kitchen_status=kitchen_status,
        payment_status=payment_status,
        notes=notes,
        subtotal=Decimal("0.00"),
        tax_total=Decimal("0.00"),
        grand_total=Decimal("0.00"),
        created_at=created_at,
        updated_at=closed_at or paid_at or created_at,
        closed_at=closed_at,
        paid_at=paid_at,
    )

    for item in items:
        product: Product = item["product"]
        quantity = int(item["quantity"])
        unit_price = Decimal(str(product.base_price))
        line_total = unit_price * quantity
        line_tax = (line_total * Decimal(str(product.tax_rate))) / Decimal("100")
        subtotal += line_total
        tax_total += line_tax
        order.items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                unit_price=unit_price,
                tax_rate=product.tax_rate,
                total_price=line_total,
                kitchen_done=kitchen_status == "completed",
                variant_label=item.get("variant_label"),
                created_at=created_at,
                updated_at=closed_at or paid_at or created_at,
            )
        )

    order.subtotal = subtotal
    order.tax_total = tax_total
    order.grand_total = subtotal + tax_total
    return order
