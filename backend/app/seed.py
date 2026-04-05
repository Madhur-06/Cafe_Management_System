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

    branches = [
        Branch(name="Main Branch", code="MAIN", address="MG Road, Bengaluru", phone="+91-9876543210", is_active=True),
        Branch(name="Downtown Branch", code="DTWN", address="Church Street, Bengaluru", phone="+91-9876543211", is_active=True),
        Branch(name="Airport Branch", code="AIR", address="Airport Road, Bengaluru", phone="+91-9876543212", is_active=True),
    ]
    db.add_all(branches)
    db.flush()

    admin = _get_or_create_user(
        db,
        name="System Admin",
        username="admin",
        email="admin@poscafe.local",
        password="admin123",
        role="admin",
        branch_id=None,
    )
    main_staff = _get_or_create_user(
        db,
        name="Riya Sharma",
        username="mainstaff",
        email="riya.main@poscafe.local",
        password="staff123",
        role="staff",
        branch_id=branches[0].id,
    )
    downtown_staff = _get_or_create_user(
        db,
        name="Arjun Mehta",
        username="downtownstaff",
        email="arjun.downtown@poscafe.local",
        password="staff123",
        role="staff",
        branch_id=branches[1].id,
    )
    main_chef = _get_or_create_user(
        db,
        name="Chef Neha",
        username="mainchef",
        email="chef.main@poscafe.local",
        password="chef123",
        role="chef",
        branch_id=branches[0].id,
    )
    downtown_chef = _get_or_create_user(
        db,
        name="Chef Kabir",
        username="downtownchef",
        email="chef.downtown@poscafe.local",
        password="chef123",
        role="chef",
        branch_id=branches[1].id,
    )
    airport_staff = _get_or_create_user(
        db,
        name="Sneha Iyer",
        username="airportstaff",
        email="sneha.airport@poscafe.local",
        password="staff123",
        role="staff",
        branch_id=branches[2].id,
    )
    airport_chef = _get_or_create_user(
        db,
        name="Chef Aman",
        username="airportchef",
        email="chef.airport@poscafe.local",
        password="chef123",
        role="chef",
        branch_id=branches[2].id,
    )
    main_staff_two = _get_or_create_user(
        db,
        name="Karan Verma",
        username="mainstaff2",
        email="karan.main@poscafe.local",
        password="staff123",
        role="staff",
        branch_id=branches[0].id,
    )
    downtown_staff_two = _get_or_create_user(
        db,
        name="Ishita Rao",
        username="downtownstaff2",
        email="ishita.downtown@poscafe.local",
        password="staff123",
        role="staff",
        branch_id=branches[1].id,
    )
    db.flush()

    categories = {
        "Starters": Category(name="Starters", is_active=True),
        "Mains": Category(name="Mains", is_active=True),
        "Beverages": Category(name="Beverages", is_active=True),
        "Desserts": Category(name="Desserts", is_active=True),
    }
    db.add_all(categories.values())
    db.flush()

    products = {
        "Bruschetta": Product(
            category_id=categories["Starters"].id,
            name="Bruschetta",
            description="Toasted artisan bread with tomato basil topping.",
            base_price=Decimal("180.00"),
            unit="plate",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=True,
            is_active=True,
        ),
        "Paneer Tikka": Product(
            category_id=categories["Starters"].id,
            name="Paneer Tikka",
            description="Smoky paneer cubes with mint chutney.",
            base_price=Decimal("260.00"),
            unit="plate",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=True,
            is_active=True,
        ),
        "Farmhouse Pizza": Product(
            category_id=categories["Mains"].id,
            name="Farmhouse Pizza",
            description="Loaded veg pizza with mozzarella and herbs.",
            base_price=Decimal("420.00"),
            unit="pizza",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=True,
            is_active=True,
        ),
        "Penne Alfredo": Product(
            category_id=categories["Mains"].id,
            name="Penne Alfredo",
            description="Creamy white sauce pasta with parmesan.",
            base_price=Decimal("340.00"),
            unit="bowl",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=True,
            is_active=True,
        ),
        "Masala Lemonade": Product(
            category_id=categories["Beverages"].id,
            name="Masala Lemonade",
            description="Fresh lemonade with house masala.",
            base_price=Decimal("110.00"),
            unit="glass",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=False,
            is_active=True,
        ),
        "Cold Coffee": Product(
            category_id=categories["Beverages"].id,
            name="Cold Coffee",
            description="Chilled coffee with whipped cream.",
            base_price=Decimal("150.00"),
            unit="glass",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=False,
            is_active=True,
        ),
        "Brownie Sundae": Product(
            category_id=categories["Desserts"].id,
            name="Brownie Sundae",
            description="Warm brownie served with vanilla ice cream.",
            base_price=Decimal("220.00"),
            unit="serve",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=True,
            is_active=True,
        ),
        "Caesar Salad": Product(
            category_id=categories["Starters"].id,
            name="Caesar Salad",
            description="Crisp lettuce, croutons, and creamy dressing.",
            base_price=Decimal("210.00"),
            unit="bowl",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=True,
            is_active=True,
        ),
        "Veg Burger": Product(
            category_id=categories["Mains"].id,
            name="Veg Burger",
            description="Loaded burger with fries on the side.",
            base_price=Decimal("280.00"),
            unit="plate",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=True,
            is_active=True,
        ),
        "Tandoori Platter": Product(
            category_id=categories["Mains"].id,
            name="Tandoori Platter",
            description="A mixed tandoori platter for sharing.",
            base_price=Decimal("560.00"),
            unit="platter",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=True,
            is_active=True,
        ),
        "Masala Chai": Product(
            category_id=categories["Beverages"].id,
            name="Masala Chai",
            description="Hot spiced tea.",
            base_price=Decimal("90.00"),
            unit="cup",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=False,
            is_active=True,
        ),
        "Fresh Lime Soda": Product(
            category_id=categories["Beverages"].id,
            name="Fresh Lime Soda",
            description="Sweet and salted soda with lime.",
            base_price=Decimal("120.00"),
            unit="glass",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=False,
            is_active=True,
        ),
        "Cheesecake": Product(
            category_id=categories["Desserts"].id,
            name="Cheesecake",
            description="New York style cheesecake slice.",
            base_price=Decimal("240.00"),
            unit="slice",
            tax_rate=5,
            image_url=None,
            send_to_kitchen=True,
            is_active=True,
        ),
    }
    db.add_all(products.values())
    db.flush()

    products["Farmhouse Pizza"].variants_rel = [
        ProductVariant(
            name="Size",
            values=[
                ProductVariantValue(label="Regular", extra_price=Decimal("0.00")),
                ProductVariantValue(label="Large", extra_price=Decimal("140.00")),
            ],
        )
    ]
    products["Cold Coffee"].variants_rel = [
        ProductVariant(
            name="Add-on",
            values=[
                ProductVariantValue(label="Vanilla", extra_price=Decimal("20.00")),
                ProductVariantValue(label="Hazelnut", extra_price=Decimal("25.00")),
            ],
        )
    ]
    products["Veg Burger"].variants_rel = [
        ProductVariant(
            name="Add-on",
            values=[
                ProductVariantValue(label="Extra Cheese", extra_price=Decimal("30.00")),
                ProductVariantValue(label="Double Patty", extra_price=Decimal("70.00")),
            ],
        )
    ]

    payment_methods = [
        PaymentMethod(name="Cash", type="cash", enabled=True, config_json={}, is_active=True),
        PaymentMethod(name="Card", type="card", enabled=True, config_json={}, is_active=True),
        PaymentMethod(name="UPI", type="upi", enabled=True, config_json={"upi_id": "cafedemo@upi"}, is_active=True),
    ]
    db.add_all(payment_methods)
    db.flush()

    floors = [
        Floor(branch_id=branches[0].id, name="Ground Floor", is_active=True),
        Floor(branch_id=branches[0].id, name="Rooftop", is_active=True),
        Floor(branch_id=branches[1].id, name="Main Dining", is_active=True),
        Floor(branch_id=branches[1].id, name="Family Section", is_active=True),
        Floor(branch_id=branches[2].id, name="Express Hall", is_active=True),
        Floor(branch_id=branches[2].id, name="Lounge", is_active=True),
    ]
    db.add_all(floors)
    db.flush()

    tables = [
        RestaurantTable(branch_id=branches[0].id, floor_id=floors[0].id, table_number="T1", seats=2, active=True),
        RestaurantTable(branch_id=branches[0].id, floor_id=floors[0].id, table_number="T2", seats=4, active=True),
        RestaurantTable(branch_id=branches[0].id, floor_id=floors[1].id, table_number="R1", seats=4, active=True),
        RestaurantTable(branch_id=branches[1].id, floor_id=floors[2].id, table_number="D1", seats=2, active=True),
        RestaurantTable(branch_id=branches[1].id, floor_id=floors[2].id, table_number="D2", seats=6, active=True),
        RestaurantTable(branch_id=branches[1].id, floor_id=floors[3].id, table_number="F1", seats=4, active=True),
        RestaurantTable(branch_id=branches[1].id, floor_id=floors[3].id, table_number="F2", seats=8, active=True),
        RestaurantTable(branch_id=branches[2].id, floor_id=floors[4].id, table_number="E1", seats=2, active=True),
        RestaurantTable(branch_id=branches[2].id, floor_id=floors[4].id, table_number="E2", seats=2, active=True),
        RestaurantTable(branch_id=branches[2].id, floor_id=floors[5].id, table_number="L1", seats=6, active=True),
    ]
    db.add_all(tables)
    db.flush()

    terminals = [
        POSTerminal(branch_id=branches[0].id, name="Main Register", location="Ground Floor", active=True),
        POSTerminal(branch_id=branches[0].id, name="Rooftop Register", location="Rooftop", active=True),
        POSTerminal(branch_id=branches[1].id, name="Downtown Register", location="Front Desk", active=True),
        POSTerminal(branch_id=branches[1].id, name="Family Register", location="Family Section", active=True),
        POSTerminal(branch_id=branches[2].id, name="Airport Register", location="Express Hall", active=True),
    ]
    db.add_all(terminals)
    db.flush()

    sessions = [
        POSSession(
            branch_id=branches[0].id,
            terminal_id=terminals[0].id,
            responsible_id=main_staff.id,
            status="open",
            opening_amount=Decimal("3000.00"),
            closing_amount=Decimal("0.00"),
            opened_at=now - timedelta(hours=4),
        ),
        POSSession(
            branch_id=branches[0].id,
            terminal_id=terminals[1].id,
            responsible_id=main_staff.id,
            status="closed",
            opening_amount=Decimal("2500.00"),
            closing_amount=Decimal("6150.00"),
            opened_at=now - timedelta(days=1, hours=6),
            closed_at=now - timedelta(days=1, hours=1),
        ),
        POSSession(
            branch_id=branches[1].id,
            terminal_id=terminals[2].id,
            responsible_id=downtown_staff.id,
            status="open",
            opening_amount=Decimal("2200.00"),
            closing_amount=Decimal("0.00"),
            opened_at=now - timedelta(hours=3),
        ),
        POSSession(
            branch_id=branches[1].id,
            terminal_id=terminals[3].id,
            responsible_id=downtown_staff_two.id,
            status="closed",
            opening_amount=Decimal("1800.00"),
            closing_amount=Decimal("4890.00"),
            opened_at=now - timedelta(days=2, hours=5),
            closed_at=now - timedelta(days=2, hours=1),
        ),
        POSSession(
            branch_id=branches[2].id,
            terminal_id=terminals[4].id,
            responsible_id=airport_staff.id,
            status="open",
            opening_amount=Decimal("3500.00"),
            closing_amount=Decimal("0.00"),
            opened_at=now - timedelta(hours=2, minutes=30),
        ),
        POSSession(
            branch_id=branches[0].id,
            terminal_id=terminals[0].id,
            responsible_id=main_staff_two.id,
            status="closed",
            opening_amount=Decimal("2900.00"),
            closing_amount=Decimal("7020.00"),
            opened_at=now - timedelta(days=3, hours=8),
            closed_at=now - timedelta(days=3, hours=1),
        ),
    ]
    db.add_all(sessions)
    db.flush()

    order_one = _build_order(
        branch_id=branches[0].id,
        session_id=sessions[0].id,
        table_id=tables[0].id,
        responsible_id=main_staff.id,
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
            {
                "product": products["Paneer Tikka"],
                "quantity": 1,
                "variant_label": None,
            },
            {
                "product": products["Farmhouse Pizza"],
                "quantity": 1,
                "variant_label": "Large",
            },
            {
                "product": products["Masala Lemonade"],
                "quantity": 2,
                "variant_label": None,
            },
        ],
    )
    db.add(order_one)
    db.flush()
    db.add(
        Payment(
            order_id=order_one.id,
            payment_method_id=payment_methods[0].id,
            amount=order_one.grand_total,
            payment_status="confirmed",
            transaction_ref="CASH-DEMO-001",
            reference="CASH-DEMO-001",
            paid_at=order_one.paid_at,
            created_at=order_one.created_at,
            updated_at=order_one.closed_at or order_one.created_at,
        )
    )

    order_two = _build_order(
        branch_id=branches[0].id,
        session_id=sessions[0].id,
        table_id=tables[1].id,
        responsible_id=main_staff.id,
        order_number="ORD-MAIN-002",
        order_type="self",
        status="sent",
        kitchen_status="preparing",
        payment_status="unpaid",
        notes="Customer self order",
        created_at=now - timedelta(minutes=40),
        items=[
            {
                "product": products["Bruschetta"],
                "quantity": 1,
                "variant_label": None,
            },
            {
                "product": products["Penne Alfredo"],
                "quantity": 2,
                "variant_label": None,
            },
            {
                "product": products["Brownie Sundae"],
                "quantity": 1,
                "variant_label": None,
            },
        ],
    )
    db.add(order_two)

    order_three = _build_order(
        branch_id=branches[1].id,
        session_id=sessions[2].id,
        table_id=tables[3].id,
        responsible_id=downtown_staff.id,
        order_number="ORD-DTWN-001",
        order_type="pos",
        status="sent",
        kitchen_status="to_cook",
        payment_status="unpaid",
        notes="Window table",
        created_at=now - timedelta(minutes=25),
        items=[
            {
                "product": products["Farmhouse Pizza"],
                "quantity": 1,
                "variant_label": "Regular",
            },
            {
                "product": products["Cold Coffee"],
                "quantity": 2,
                "variant_label": "Hazelnut",
            },
        ],
    )
    db.add(order_three)

    order_four = _build_order(
        branch_id=branches[1].id,
        session_id=sessions[2].id,
        table_id=tables[4].id,
        responsible_id=downtown_staff.id,
        order_number="ORD-DTWN-002",
        order_type="pos",
        status="completed",
        kitchen_status="completed",
        payment_status="paid",
        notes="Family dinner",
        created_at=now - timedelta(hours=1, minutes=15),
        closed_at=now - timedelta(hours=1),
        paid_at=now - timedelta(hours=1),
        items=[
            {"product": products["Tandoori Platter"], "quantity": 1, "variant_label": None},
            {"product": products["Fresh Lime Soda"], "quantity": 3, "variant_label": None},
            {"product": products["Cheesecake"], "quantity": 2, "variant_label": None},
        ],
    )
    db.add(order_four)
    db.flush()
    db.add(
        Payment(
            order_id=order_four.id,
            payment_method_id=payment_methods[2].id,
            amount=order_four.grand_total,
            payment_status="confirmed",
            transaction_ref="UPI-DEMO-004",
            reference="UPI-DEMO-004",
            paid_at=order_four.paid_at,
            created_at=order_four.created_at,
            updated_at=order_four.closed_at or order_four.created_at,
        )
    )

    order_five = _build_order(
        branch_id=branches[2].id,
        session_id=sessions[4].id,
        table_id=tables[7].id,
        responsible_id=airport_staff.id,
        order_number="ORD-AIR-001",
        order_type="self",
        status="sent",
        kitchen_status="to_cook",
        payment_status="unpaid",
        notes="Quick bite before boarding",
        created_at=now - timedelta(minutes=18),
        items=[
            {"product": products["Veg Burger"], "quantity": 2, "variant_label": "Extra Cheese"},
            {"product": products["Masala Chai"], "quantity": 2, "variant_label": None},
        ],
    )
    db.add(order_five)

    order_six = _build_order(
        branch_id=branches[0].id,
        session_id=sessions[0].id,
        table_id=tables[2].id,
        responsible_id=main_staff_two.id,
        order_number="ORD-MAIN-003",
        order_type="pos",
        status="completed",
        kitchen_status="completed",
        payment_status="paid",
        notes="Rooftop evening order",
        created_at=now - timedelta(hours=3, minutes=10),
        closed_at=now - timedelta(hours=2, minutes=40),
        paid_at=now - timedelta(hours=2, minutes=40),
        items=[
            {"product": products["Caesar Salad"], "quantity": 1, "variant_label": None},
            {"product": products["Cold Coffee"], "quantity": 2, "variant_label": "Vanilla"},
            {"product": products["Brownie Sundae"], "quantity": 1, "variant_label": None},
        ],
    )
    db.add(order_six)
    db.flush()
    db.add(
        Payment(
            order_id=order_six.id,
            payment_method_id=payment_methods[1].id,
            amount=order_six.grand_total,
            payment_status="confirmed",
            transaction_ref="CARD-DEMO-006",
            reference="CARD-DEMO-006",
            paid_at=order_six.paid_at,
            created_at=order_six.created_at,
            updated_at=order_six.closed_at or order_six.created_at,
        )
    )

    db.flush()

    db.add_all(
        [
            SelfOrderToken(
                branch_id=branches[0].id,
                token=token_hex(6),
                table_id=tables[1].id,
                session_id=sessions[0].id,
                active=True,
                expires_at=now + timedelta(hours=6),
                created_at=now - timedelta(hours=1),
                updated_at=now - timedelta(hours=1),
            ),
            SelfOrderToken(
                branch_id=branches[2].id,
                token=token_hex(6),
                table_id=tables[7].id,
                session_id=sessions[4].id,
                active=True,
                expires_at=now + timedelta(hours=8),
                created_at=now - timedelta(minutes=45),
                updated_at=now - timedelta(minutes=45),
            ),
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
