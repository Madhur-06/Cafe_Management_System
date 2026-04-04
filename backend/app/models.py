from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="admin")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    sessions: Mapped[list["POSSession"]] = relationship(back_populates="responsible")
    orders: Mapped[list["Order"]] = relationship(back_populates="responsible")


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    name: Mapped[str] = mapped_column(String(120), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    unit: Mapped[str] = mapped_column(String(50), default="unit")
    tax_rate: Mapped[float] = mapped_column(Float, default=0)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    send_to_kitchen: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped["Category"] = relationship(back_populates="products")
    variants_rel: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="product")

    @hybrid_property
    def price(self) -> Decimal:
        return self.base_price

    @price.setter
    def price(self, value: Decimal | float) -> None:
        self.base_price = Decimal(str(value))

    @hybrid_property
    def tax(self) -> float:
        return self.tax_rate

    @tax.setter
    def tax(self, value: float) -> None:
        self.tax_rate = value

    @hybrid_property
    def image(self) -> str | None:
        return self.image_url

    @image.setter
    def image(self, value: str | None) -> None:
        self.image_url = value

    @property
    def variants(self) -> list[dict[str, Any]]:
        return [
            {
                "name": variant.name,
                "values": [
                    {"label": value.label, "extra_price": float(value.extra_price)}
                    for value in variant.values
                ],
            }
            for variant in self.variants_rel
        ]


class ProductVariant(Base, TimestampMixin):
    __tablename__ = "product_variants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    name: Mapped[str] = mapped_column(String(120))

    product: Mapped["Product"] = relationship(back_populates="variants_rel")
    values: Mapped[list["ProductVariantValue"]] = relationship(
        back_populates="variant",
        cascade="all, delete-orphan",
    )


class ProductVariantValue(Base, TimestampMixin):
    __tablename__ = "product_variant_values"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"))
    label: Mapped[str] = mapped_column(String(120))
    extra_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    variant: Mapped["ProductVariant"] = relationship(back_populates="values")


class PaymentMethod(Base, TimestampMixin):
    __tablename__ = "payment_methods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    type: Mapped[str] = mapped_column(String(50))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    @property
    def upi_id(self) -> str | None:
        return (self.config_json or {}).get("upi_id")


class Floor(Base, TimestampMixin):
    __tablename__ = "floors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tables: Mapped[list["RestaurantTable"]] = relationship(back_populates="floor")


class RestaurantTable(Base, TimestampMixin):
    __tablename__ = "restaurant_tables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    floor_id: Mapped[int] = mapped_column(ForeignKey("floors.id"))
    table_number: Mapped[str] = mapped_column(String(50))
    seats: Mapped[int] = mapped_column(Integer, default=2)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    floor: Mapped["Floor"] = relationship(back_populates="tables")
    orders: Mapped[list["Order"]] = relationship(back_populates="table")

    @property
    def appointment_resource(self) -> str | None:
        return None


class POSTerminal(Base, TimestampMixin):
    __tablename__ = "pos_terminals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    location: Mapped[str] = mapped_column(String(120), default="Main Hall")
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    sessions: Mapped[list["POSSession"]] = relationship(back_populates="terminal")


class POSSession(Base, TimestampMixin):
    __tablename__ = "pos_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    terminal_id: Mapped[int] = mapped_column(ForeignKey("pos_terminals.id"))
    responsible_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(50), default="open")
    opening_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    closing_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    terminal: Mapped["POSTerminal"] = relationship(back_populates="sessions")
    responsible: Mapped["User"] = relationship(back_populates="sessions")
    orders: Mapped[list["Order"]] = relationship(back_populates="session")


class SelfOrderToken(Base, TimestampMixin):
    __tablename__ = "self_order_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("restaurant_tables.id"))
    session_id: Mapped[int] = mapped_column(ForeignKey("pos_sessions.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("pos_sessions.id"))
    table_id: Mapped[int | None] = mapped_column(ForeignKey("restaurant_tables.id"), nullable=True)
    responsible_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    order_type: Mapped[str] = mapped_column(String(50), default="pos")
    status: Mapped[str] = mapped_column(String(50), default="draft")
    kitchen_status: Mapped[str] = mapped_column(String(50), default="pending")
    payment_status: Mapped[str] = mapped_column(String(50), default="unpaid")
    notes: Mapped[str] = mapped_column(Text, default="")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    tax_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    session: Mapped["POSSession"] = relationship(back_populates="orders")
    responsible: Mapped["User"] = relationship(back_populates="orders")
    table: Mapped["RestaurantTable"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="order", cascade="all, delete-orphan")

    @property
    def source(self) -> str:
        return self.order_type


class OrderItem(Base, TimestampMixin):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    product_name: Mapped[str] = mapped_column(String(120))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    tax_rate: Mapped[float] = mapped_column(Float, default=0)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    kitchen_done: Mapped[bool] = mapped_column(Boolean, default=False)
    variant_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    order: Mapped["Order"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship(back_populates="order_items")


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    payment_method_id: Mapped[int] = mapped_column(ForeignKey("payment_methods.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    payment_status: Mapped[str] = mapped_column(String(50), default="confirmed")
    transaction_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    order: Mapped["Order"] = relationship(back_populates="payments")

    @property
    def status(self) -> str:
        return self.payment_status
