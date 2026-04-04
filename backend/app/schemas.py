from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class BranchInput(BaseModel):
    name: str
    code: str
    address: str = ""
    phone: str = ""
    is_active: bool = True


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    address: str
    phone: str
    is_active: bool


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int | None = None
    branch_name: str | None = None
    name: str
    username: str
    email: str
    role: str
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginInput(BaseModel):
    username: str
    password: str


class SignupInput(BaseModel):
    name: str
    email: str
    password: str


class UserCreateInput(BaseModel):
    branch_id: int | None = None
    name: str
    username: str
    email: str
    password: str
    role: str


class UserUpdateInput(BaseModel):
    branch_id: int | None = None
    name: str
    username: str
    email: str
    password: str | None = None
    role: str
    is_active: bool = True


class CategoryInput(BaseModel):
    name: str


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_active: bool


class ProductInput(BaseModel):
    name: str
    category_id: int
    price: float
    unit: str = "unit"
    tax: float = 0
    description: str = ""
    image: str | None = None
    send_to_kitchen: bool = True
    variants: list[dict[str, Any]] = Field(default_factory=list)


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category_id: int
    price: float
    unit: str
    tax: float
    description: str
    image: str | None
    send_to_kitchen: bool
    variants: list[dict[str, Any]]
    is_active: bool


class PaymentMethodInput(BaseModel):
    name: str
    type: str
    enabled: bool = True
    upi_id: str | None = None


class PaymentMethodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    enabled: bool
    upi_id: str | None
    is_active: bool


class FloorInput(BaseModel):
    name: str


class TableInput(BaseModel):
    floor_id: int
    table_number: str
    seats: int = 2
    active: bool = True
    appointment_resource: str | None = None


class TableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int | None = None
    branch_name: str | None = None
    floor_id: int
    table_number: str
    seats: int
    active: bool
    appointment_resource: str | None = None


class FloorWithTables(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int | None = None
    branch_name: str | None = None
    name: str
    is_active: bool
    tables: list[TableOut]


class TerminalInput(BaseModel):
    name: str
    location: str = "Main Hall"
    active: bool = True


class TerminalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int | None = None
    branch_name: str | None = None
    name: str
    location: str
    active: bool
    last_closing_sale_amount: float = 0
    last_open_session_id: int | None = None
    open_session_id: int | None = None


class SessionOpenInput(BaseModel):
    terminal_id: int
    opening_amount: float = 0


class SessionCloseInput(BaseModel):
    closing_amount: float


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int | None = None
    branch_name: str | None = None
    terminal_id: int
    responsible_id: int
    status: str
    opening_amount: float
    closing_amount: float
    opened_at: datetime
    closed_at: datetime | None
    created_at: datetime


class OrderItemInput(BaseModel):
    product_id: int
    quantity: int = Field(default=1, gt=0)
    variant_label: str | None = None


class OrderCreateInput(BaseModel):
    session_id: int
    table_id: int | None = None
    source: str = "pos"
    notes: str = ""
    items: list[OrderItemInput]


class PaymentInput(BaseModel):
    payment_method_id: int | None = None
    payment_method_code: str | None = None
    amount: float
    reference: str | None = None


class SelfOrderTokenOut(BaseModel):
    token: str
    branch_id: int | None = None
    table_id: int
    session_id: int


class SelfOrderInput(BaseModel):
    token: str
    items: list[OrderItemInput]
    notes: str = ""
