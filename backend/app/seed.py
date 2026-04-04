from decimal import Decimal

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models import Category, Floor, POSTerminal, PaymentMethod, Product, RestaurantTable, User


def seed_database(db: Session) -> None:
    if db.query(User).first():
        return

    admin = User(name="Cafe Admin", email="admin@odoo-pos.local", password_hash=hash_password("admin123"), role="admin")
    db.add(admin)

    categories = [Category(name="Pizza"), Category(name="Pasta"), Category(name="Beverages"), Category(name="Dessert")]
    db.add_all(categories)
    db.flush()

    products = [
        Product(name="Margherita Pizza", category_id=categories[0].id, price=Decimal("320"), unit="plate", tax=5, description="Classic pizza with basil and mozzarella.", image="https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=800&q=80", variants=[{"attribute": "Pack", "values": [{"label": "6 inch", "extra_price": 0}, {"label": "12 inch", "extra_price": 110}]}]),
        Product(name="Alfredo Pasta", category_id=categories[1].id, price=Decimal("260"), unit="bowl", tax=5, description="Creamy white sauce pasta.", image="https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80"),
        Product(name="Cold Coffee", category_id=categories[2].id, price=Decimal("140"), unit="glass", tax=5, description="Iced coffee with cream.", image="https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80"),
        Product(name="Water Bottle", category_id=categories[2].id, price=Decimal("40"), unit="bottle", tax=0, description="500 ml mineral water.", send_to_kitchen=False, image="https://images.unsplash.com/photo-1564419431639-1e8f54f18881?auto=format&fit=crop&w=800&q=80"),
        Product(name="Chocolate Brownie", category_id=categories[3].id, price=Decimal("160"), unit="piece", tax=5, description="Warm brownie with sauce.", image="https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80"),
    ]
    db.add_all(products)

    methods = [
        PaymentMethod(name="Cash", type="cash", enabled=True),
        PaymentMethod(name="Digital", type="digital", enabled=True),
        PaymentMethod(name="UPI QR", type="upi", enabled=True, upi_id="123@ybl.com"),
    ]
    db.add_all(methods)

    floor = Floor(name="Ground Floor")
    db.add(floor)
    db.flush()

    tables = [
        RestaurantTable(floor_id=floor.id, table_number="Table 1", seats=2, active=True),
        RestaurantTable(floor_id=floor.id, table_number="Table 3", seats=4, active=True),
        RestaurantTable(floor_id=floor.id, table_number="Table 6", seats=4, active=True),
        RestaurantTable(floor_id=floor.id, table_number="Table 8", seats=6, active=True),
    ]
    db.add_all(tables)
    db.add(POSTerminal(name="Cafe Main Register", location="Ground Floor"))
    db.commit()
