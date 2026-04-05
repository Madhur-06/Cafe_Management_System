from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from secrets import token_hex

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from app.auth import create_access_token, get_current_user, hash_password, require_role, verify_password
from app.config import settings
from app.database import Base, engine, get_db
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
from app.schemas import (
    BranchInput,
    BranchOut,
    CategoryInput,
    CategoryOut,
    FloorInput,
    FloorWithTables,
    LoginInput,
    OrderCreateInput,
    PaymentInput,
    PaymentMethodInput,
    PaymentMethodOut,
    ProductInput,
    ProductOut,
    SessionCloseInput,
    SessionOpenInput,
    SessionOut,
    SelfOrderInput,
    SelfOrderTokenOut,
    SignupInput,
    TableInput,
    TableOut,
    TerminalInput,
    TerminalOut,
    TokenResponse,
    UserCreateInput,
    UserOut,
    UserUpdateInput,
)


app = FastAPI(title="Odoo POS Cafe API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


FIXED_PAYMENT_METHODS = {
    "cash": {"name": "Cash", "type": "cash"},
    "card": {"name": "Card", "type": "card"},
    "upi": {"name": "UPI", "type": "upi"},
}
ALLOWED_USER_ROLES = {"admin", "staff", "chef"}
DEFAULT_BRANCH_NAME = "Main Branch"
DEFAULT_BRANCH_CODE = "MAIN"


def payment_method_to_payload(method: PaymentMethod) -> dict:
    return {
        "id": method.id,
        "name": method.name,
        "type": method.type,
        "enabled": method.enabled,
        "upi_id": method.upi_id,
        "is_active": method.is_active,
    }


def normalize_username(value: str) -> str:
    return value.strip().lower()


def normalize_branch_code(value: str) -> str:
    cleaned = "".join(char for char in str(value or "").strip().upper().replace(" ", "_") if char.isalnum() or char in {"_", "-"})
    return cleaned or DEFAULT_BRANCH_CODE


def ensure_usernames(db: Session) -> None:
    db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50)"))
    db.commit()

    existing_users = db.query(User).order_by(User.id).all()
    used: set[str] = set()
    changed = False

    for user in existing_users:
        candidate = getattr(user, "username", None) or user.email.split("@")[0] or f"user{user.id}"
        candidate = normalize_username(candidate)
        if not candidate:
            candidate = f"user{user.id}"
        base = candidate
        suffix = 1
        while candidate in used or db.query(User).filter(User.username == candidate, User.id != user.id).first():
            suffix += 1
            candidate = f"{base}{suffix}"
        if getattr(user, "username", None) != candidate:
            user.username = candidate
            changed = True
        used.add(candidate)

    if changed:
        db.commit()

    db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
    db.commit()


def ensure_admin_user(db: Session) -> None:
    admin_username = normalize_username(settings.bootstrap_admin_username)
    admin_email = settings.bootstrap_admin_email.strip().lower()
    admin_name = settings.bootstrap_admin_name.strip() or "System Admin"
    admin_password = settings.bootstrap_admin_password

    if not admin_username:
        admin_username = "admin"
    if not admin_email:
        admin_email = "admin@poscafe.local"
    if not admin_password:
        admin_password = "admin123"

    existing_admin = (
        db.query(User)
        .filter((User.role == "admin") | (User.username == admin_username) | (User.email == admin_email))
        .order_by(User.id)
        .first()
    )

    if existing_admin:
        changed = False
        if existing_admin.role != "admin":
            existing_admin.role = "admin"
            changed = True
        if not existing_admin.is_active:
            existing_admin.is_active = True
            changed = True
        if not existing_admin.username:
            existing_admin.username = admin_username
            changed = True
        if not existing_admin.email:
            existing_admin.email = admin_email
            changed = True
        if changed:
            db.commit()
        return

    admin_user = User(
        branch_id=None,
        name=admin_name,
        username=admin_username,
        email=admin_email,
        password_hash=hash_password(admin_password),
        role="admin",
        is_active=True,
    )
    db.add(admin_user)
    db.commit()


def ensure_branches(db: Session) -> None:
    db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
    db.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
    db.execute(text("ALTER TABLE floors ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
    db.execute(text("ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
    db.execute(text("ALTER TABLE pos_terminals ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
    db.execute(text("ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
    db.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
    db.execute(text("ALTER TABLE self_order_tokens ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
    db.execute(text("ALTER TABLE floors DROP CONSTRAINT IF EXISTS floors_name_key"))
    db.execute(text("ALTER TABLE pos_terminals DROP CONSTRAINT IF EXISTS pos_terminals_name_key"))
    db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_floors_branch_name_idx ON floors (branch_id, name)"))
    db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_tables_branch_number_idx ON restaurant_tables (branch_id, table_number)"))
    db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_terminals_branch_name_idx ON pos_terminals (branch_id, name)"))
    db.commit()

    default_branch = db.query(Branch).order_by(Branch.id).first()
    if not default_branch:
        default_branch = Branch(
            name=DEFAULT_BRANCH_NAME,
            code=DEFAULT_BRANCH_CODE,
            address="",
            phone="",
            is_active=True,
        )
        db.add(default_branch)
        db.commit()
        db.refresh(default_branch)

    branch_id = default_branch.id
    db.execute(text("UPDATE users SET branch_id = :branch_id WHERE branch_id IS NULL AND lower(role) <> 'admin'"), {"branch_id": branch_id})
    db.execute(text("UPDATE products SET branch_id = :branch_id WHERE branch_id IS NULL"), {"branch_id": branch_id})
    db.execute(text("UPDATE floors SET branch_id = :branch_id WHERE branch_id IS NULL"), {"branch_id": branch_id})
    db.execute(
        text(
            "UPDATE restaurant_tables AS t SET branch_id = f.branch_id "
            "FROM floors AS f WHERE t.floor_id = f.id AND t.branch_id IS NULL"
        )
    )
    db.execute(text("UPDATE restaurant_tables SET branch_id = :branch_id WHERE branch_id IS NULL"), {"branch_id": branch_id})
    db.execute(text("UPDATE pos_terminals SET branch_id = :branch_id WHERE branch_id IS NULL"), {"branch_id": branch_id})
    db.execute(
        text(
            "UPDATE pos_sessions AS s SET branch_id = t.branch_id "
            "FROM pos_terminals AS t WHERE s.terminal_id = t.id AND s.branch_id IS NULL"
        )
    )
    db.execute(text("UPDATE pos_sessions SET branch_id = :branch_id WHERE branch_id IS NULL"), {"branch_id": branch_id})
    db.execute(
        text(
            "UPDATE orders AS o SET branch_id = s.branch_id "
            "FROM pos_sessions AS s WHERE o.session_id = s.id AND o.branch_id IS NULL"
        )
    )
    db.execute(text("UPDATE orders SET branch_id = :branch_id WHERE branch_id IS NULL"), {"branch_id": branch_id})
    db.execute(
        text(
            "UPDATE self_order_tokens AS t SET branch_id = s.branch_id "
            "FROM pos_sessions AS s WHERE t.session_id = s.id AND t.branch_id IS NULL"
        )
    )
    db.execute(text("UPDATE self_order_tokens SET branch_id = :branch_id WHERE branch_id IS NULL"), {"branch_id": branch_id})
    db.commit()


def get_first_active_branch(db: Session) -> Branch | None:
    return db.query(Branch).filter(Branch.is_active.is_(True)).order_by(Branch.id).first() or db.query(Branch).order_by(Branch.id).first()


def get_branch_or_404(db: Session, branch_id: int) -> Branch:
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


def resolve_branch_for_user(db: Session, current_user: User, branch_id: int | None = None, allow_inactive: bool = False) -> Branch:
    role = current_user.role.lower()
    if role == "admin":
        branch = get_branch_or_404(db, branch_id) if branch_id else get_first_active_branch(db)
        if not branch:
            raise HTTPException(status_code=400, detail="No branch is configured yet")
        if not allow_inactive and not branch.is_active:
            raise HTTPException(status_code=400, detail="Selected branch is inactive")
        return branch

    if not current_user.branch_id:
        raise HTTPException(status_code=400, detail="This user is not assigned to a branch")
    if branch_id is not None and branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="You do not have access to this branch")
    branch = get_branch_or_404(db, current_user.branch_id)
    if not allow_inactive and not branch.is_active:
        raise HTTPException(status_code=400, detail="Assigned branch is inactive")
    return branch


def resolve_public_branch(db: Session, branch_id: int | None = None) -> Branch:
    branch = get_branch_or_404(db, branch_id) if branch_id else get_first_active_branch(db)
    if not branch:
        raise HTTPException(status_code=400, detail="No branch is configured yet")
    if not branch.is_active:
        raise HTTPException(status_code=400, detail="Selected branch is inactive")
    return branch


def ensure_branch_access(current_user: User, branch_id: int | None) -> None:
    if current_user.role.lower() != "admin" and current_user.branch_id != branch_id:
        raise HTTPException(status_code=403, detail="You do not have access to this branch")


def terminal_runtime_info(db: Session, branch_id: int) -> tuple[dict[int, int], dict[int, float]]:
    open_sessions = {
        session.terminal_id: session.id
        for session in db.query(POSSession).filter(POSSession.status == "open", POSSession.branch_id == branch_id).all()
    }
    last_closing_amounts: dict[int, float] = {}
    closed_sessions = (
        db.query(POSSession)
        .filter(POSSession.status == "closed", POSSession.branch_id == branch_id)
        .order_by(POSSession.closed_at.desc().nullslast(), POSSession.updated_at.desc())
        .all()
    )
    for session in closed_sessions:
        if session.terminal_id not in last_closing_amounts:
            last_closing_amounts[session.terminal_id] = float(session.closing_amount)
    return open_sessions, last_closing_amounts


def order_query(db: Session):
    return db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.product),
        joinedload(Order.table),
        joinedload(Order.payments).joinedload(Payment.payment_method),
        joinedload(Order.branch),
        joinedload(Order.responsible),
    )


def serialize_order(order: Order) -> dict:
    return {
        "id": order.id,
        "branch_id": order.branch_id,
        "branch_name": order.branch_name,
        "order_number": order.order_number,
        "session_id": order.session_id,
        "table_id": order.table_id,
        "table_name": order.table.table_number if order.table else "Takeaway",
        "source": order.order_type,
        "order_type": order.order_type,
        "responsible_id": order.responsible_id,
        "responsible_name": order.responsible.name if order.responsible else None,
        "status": order.status,
        "kitchen_status": order.kitchen_status,
        "payment_status": order.payment_status,
        "notes": order.notes,
        "subtotal": float(order.subtotal),
        "tax_total": float(order.tax_total),
        "grand_total": float(order.grand_total),
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "closed_at": order.closed_at.isoformat() if order.closed_at else None,
        "created_at": order.created_at.isoformat(),
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "name": item.product_name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "tax_rate": item.tax_rate,
                "total_price": float(item.total_price),
                "kitchen_done": item.kitchen_done,
                "variant_label": item.variant_label,
                "send_to_kitchen": item.product.send_to_kitchen if item.product else True,
            }
            for item in order.items
        ],
        "payments": [
            {
                "id": payment.id,
                "amount": float(payment.amount),
                "status": payment.payment_status,
                "payment_status": payment.payment_status,
                "reference": payment.reference,
                "transaction_ref": payment.transaction_ref,
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
                "payment_method_id": payment.payment_method_id,
                "payment_method_code": payment.payment_method.type if payment.payment_method else None,
                "payment_method_name": payment.payment_method.name if payment.payment_method else None,
            }
            for payment in order.payments
        ],
    }


def sync_product_variants(product: Product, variant_payloads: list[dict]) -> None:
    product.variants_rel.clear()
    for variant_payload in variant_payloads:
        variant_name = str(variant_payload.get("name", "")).strip()
        if not variant_name:
            continue
        variant = ProductVariant(name=variant_name)
        for value_payload in variant_payload.get("values", []):
            label = str(value_payload.get("label", "")).strip()
            if not label:
                continue
            variant.values.append(
                ProductVariantValue(
                    label=label,
                    extra_price=Decimal(str(value_payload.get("extra_price", 0) or 0)),
                )
            )
        product.variants_rel.append(variant)


def apply_product_payload(product: Product, payload: ProductInput, branch_id: int | None = None) -> None:
    if branch_id is not None:
        product.branch_id = branch_id
    product.name = payload.name
    product.category_id = payload.category_id
    product.base_price = Decimal(str(payload.price))
    product.unit = payload.unit
    product.tax_rate = payload.tax
    product.description = payload.description
    product.image_url = payload.image
    product.send_to_kitchen = payload.send_to_kitchen
    sync_product_variants(product, payload.variants)


def resolve_fixed_payment_method(db: Session, payment_method_id: int | None, payment_method_code: str | None) -> PaymentMethod:
    if payment_method_code:
        method_key = str(payment_method_code).strip().lower()
        if method_key not in FIXED_PAYMENT_METHODS:
            raise HTTPException(status_code=400, detail="Invalid payment method")
        method = db.query(PaymentMethod).filter(PaymentMethod.type == method_key).first()
        if not method:
            fixed_method = FIXED_PAYMENT_METHODS[method_key]
            method = PaymentMethod(
                name=fixed_method["name"],
                type=fixed_method["type"],
                enabled=True,
                is_active=True,
                config_json={},
            )
            db.add(method)
            db.flush()
        else:
            fixed_method = FIXED_PAYMENT_METHODS[method_key]
            method.name = fixed_method["name"]
            method.type = fixed_method["type"]
            method.enabled = True
            method.is_active = True
        return method

    if payment_method_id is None:
        raise HTTPException(status_code=400, detail="Payment method is required")

    method = db.get(PaymentMethod, payment_method_id)
    if not method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    if not method.enabled or not method.is_active:
        raise HTTPException(status_code=400, detail="Payment method is disabled")
    return method


def build_order(db: Session, payload: OrderCreateInput, responsible_id: int | None = None) -> Order:
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must include at least one item")

    session = db.get(POSSession, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "open":
        raise HTTPException(status_code=400, detail="Orders can only be created in an open session")
    if not session.branch_id:
        raise HTTPException(status_code=400, detail="Session is not linked to a branch")

    if payload.table_id is not None:
        table = db.get(RestaurantTable, payload.table_id)
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
        if table.branch_id != session.branch_id:
            raise HTTPException(status_code=400, detail="Table does not belong to the session branch")

    order = Order(
        branch_id=session.branch_id,
        order_number=f"ORD-{token_hex(3).upper()}",
        session_id=payload.session_id,
        table_id=payload.table_id,
        responsible_id=responsible_id or session.responsible_id,
        order_type=payload.source,
        notes=payload.notes,
        status="sent" if payload.source == "self" else "draft",
        kitchen_status="to_cook" if payload.source == "self" else "pending",
    )

    subtotal = Decimal("0")
    tax_total = Decimal("0")

    for item in payload.items:
        product = db.get(Product, item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.branch_id != session.branch_id:
            raise HTTPException(status_code=400, detail=f"Product {product.name} does not belong to the session branch")
        line_total = Decimal(str(product.base_price)) * item.quantity
        line_tax = line_total * Decimal(str(product.tax_rate / 100))
        subtotal += line_total
        tax_total += line_tax
        order.items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                quantity=item.quantity,
                unit_price=product.base_price,
                tax_rate=product.tax_rate,
                total_price=line_total,
                variant_label=item.variant_label,
            )
        )

    order.subtotal = subtotal
    order.tax_total = tax_total
    order.grand_total = subtotal + tax_total
    return order


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    with Session(bind=engine) as db:
        ensure_branches(db)
        ensure_usernames(db)
        ensure_admin_user(db)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/auth/signup", response_model=TokenResponse)
def signup(payload: SignupInput, db: Session = Depends(get_db)) -> TokenResponse:
    raise HTTPException(status_code=403, detail="Sign up is disabled. Ask an admin to create your account.")


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginInput, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).options(joinedload(User.branch)).filter(User.username == normalize_username(payload.username)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")
    return TokenResponse(access_token=create_access_token(user), user=user)


@app.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@app.get("/branches", response_model=list[BranchOut])
def list_branches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Branch]:
    if current_user.role.lower() == "admin":
        return db.query(Branch).order_by(Branch.name).all()
    if current_user.branch_id:
        branch = db.get(Branch, current_user.branch_id)
        return [branch] if branch else []
    return []


@app.post("/branches", response_model=BranchOut)
def create_branch(payload: BranchInput, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> Branch:
    code = normalize_branch_code(payload.code)
    if db.query(Branch).filter(Branch.name == payload.name.strip()).first():
        raise HTTPException(status_code=400, detail="Branch name already exists")
    if db.query(Branch).filter(Branch.code == code).first():
        raise HTTPException(status_code=400, detail="Branch code already exists")
    branch = Branch(
        name=payload.name.strip(),
        code=code,
        address=payload.address.strip(),
        phone=payload.phone.strip(),
        is_active=payload.is_active,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@app.patch("/branches/{branch_id}", response_model=BranchOut)
def update_branch(branch_id: int, payload: BranchInput, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> Branch:
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    code = normalize_branch_code(payload.code)
    duplicate_name = db.query(Branch).filter(Branch.name == payload.name.strip(), Branch.id != branch_id).first()
    if duplicate_name:
        raise HTTPException(status_code=400, detail="Branch name already exists")
    duplicate_code = db.query(Branch).filter(Branch.code == code, Branch.id != branch_id).first()
    if duplicate_code:
        raise HTTPException(status_code=400, detail="Branch code already exists")
    branch.name = payload.name.strip()
    branch.code = code
    branch.address = payload.address.strip()
    branch.phone = payload.phone.strip()
    branch.is_active = payload.is_active
    db.commit()
    db.refresh(branch)
    return branch


@app.delete("/branches/{branch_id}")
def delete_branch(branch_id: int, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    total_branches = db.query(Branch).count()
    if total_branches <= 1:
        raise HTTPException(status_code=400, detail="You cannot delete the last remaining branch")
    if db.query(User).filter(User.branch_id == branch_id).first():
        raise HTTPException(status_code=400, detail="Branch cannot be deleted because users are assigned to it")
    if db.query(Floor).filter(Floor.branch_id == branch_id).first():
        raise HTTPException(status_code=400, detail="Branch cannot be deleted because floors exist for it")
    if db.query(RestaurantTable).filter(RestaurantTable.branch_id == branch_id).first():
        raise HTTPException(status_code=400, detail="Branch cannot be deleted because tables exist for it")
    if db.query(POSTerminal).filter(POSTerminal.branch_id == branch_id).first():
        raise HTTPException(status_code=400, detail="Branch cannot be deleted because terminals exist for it")
    if db.query(POSSession).filter(POSSession.branch_id == branch_id).first():
        raise HTTPException(status_code=400, detail="Branch cannot be deleted because sessions exist for it")
    if db.query(Order).filter(Order.branch_id == branch_id).first():
        raise HTTPException(status_code=400, detail="Branch cannot be deleted because orders exist for it")
    if db.query(SelfOrderToken).filter(SelfOrderToken.branch_id == branch_id).first():
        raise HTTPException(status_code=400, detail="Branch cannot be deleted because self-order tokens exist for it")

    db.delete(branch)
    db.commit()
    return {"message": "Branch deleted"}


@app.get("/users", response_model=list[UserOut])
def list_users(current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[User]:
    return db.query(User).options(joinedload(User.branch)).order_by(User.created_at.desc()).all()


@app.post("/users", response_model=UserOut)
def create_user(payload: UserCreateInput, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> User:
    role = payload.role.strip().lower()
    if role not in {"staff", "chef"}:
        raise HTTPException(status_code=400, detail="Role must be staff or chef")
    if payload.branch_id is None:
        raise HTTPException(status_code=400, detail="Branch is required")
    branch = get_branch_or_404(db, payload.branch_id)
    if not branch.is_active:
        raise HTTPException(status_code=400, detail="Selected branch is inactive")

    username = normalize_username(payload.username)
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == payload.email.strip().lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        branch_id=branch.id,
        name=payload.name.strip(),
        username=username,
        email=payload.email.strip().lower(),
        password_hash=hash_password(payload.password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdateInput, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = payload.role.strip().lower()
    branch_id = payload.branch_id
    if user.id == current_user.id:
        role = "admin"
        branch_id = user.branch_id
    elif role not in {"staff", "chef"}:
        raise HTTPException(status_code=400, detail="Role must be staff or chef")

    if role in {"staff", "chef"} and branch_id is None:
        raise HTTPException(status_code=400, detail="Branch is required")
    if branch_id is not None:
        branch = get_branch_or_404(db, branch_id)
        if not branch.is_active:
            raise HTTPException(status_code=400, detail="Selected branch is inactive")

    username = normalize_username(payload.username)
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    duplicate_username = db.query(User).filter(User.username == username, User.id != user_id).first()
    if duplicate_username:
        raise HTTPException(status_code=400, detail="Username already exists")

    email = payload.email.strip().lower()
    duplicate_email = db.query(User).filter(User.email == email, User.id != user_id).first()
    if duplicate_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    user.branch_id = branch_id
    user.name = payload.name.strip()
    user.username = username
    user.email = email
    user.role = role
    user.is_active = payload.is_active if user.id != current_user.id else True
    if payload.password:
        user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return user


@app.delete("/users/{user_id}")
def delete_user(user_id: int, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}


@app.get("/dashboard")
def dashboard(branch_id: int | None = None, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    branch = resolve_branch_for_user(db, current_user, branch_id)
    total_sales = db.query(func.coalesce(func.sum(Order.grand_total), 0)).filter(Order.branch_id == branch.id).scalar() or 0
    paid_orders = db.query(Order).filter(Order.branch_id == branch.id, Order.payment_status == "paid").count()
    open_sessions = db.query(POSSession).filter(POSSession.branch_id == branch.id, POSSession.status == "open").count()
    kitchen_pending = db.query(Order).filter(Order.branch_id == branch.id, Order.kitchen_status.in_(["to_cook", "preparing"])).count()
    recent_orders = order_query(db).filter(Order.branch_id == branch.id).order_by(Order.created_at.desc()).limit(5).all()
    return {
        "branch": BranchOut.model_validate(branch).model_dump(),
        "summary": {
            "total_sales": float(total_sales),
            "paid_orders": paid_orders,
            "open_sessions": open_sessions,
            "kitchen_pending": kitchen_pending,
        },
        "recent_orders": [serialize_order(order) for order in recent_orders],
    }


@app.get("/categories", response_model=list[CategoryOut])
def list_categories(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Category]:
    return db.query(Category).order_by(Category.name).all()


@app.post("/categories", response_model=CategoryOut)
def create_category(payload: CategoryInput, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> Category:
    if db.query(Category).filter(Category.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Category already exists")
    category = Category(name=payload.name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@app.get("/products", response_model=list[ProductOut])
def list_products(branch_id: int | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Product]:
    branch = resolve_branch_for_user(db, current_user, branch_id)
    return (
        db.query(Product)
        .options(joinedload(Product.branch), joinedload(Product.variants_rel).joinedload(ProductVariant.values))
        .filter(Product.branch_id == branch.id)
        .order_by(Product.name)
        .all()
    )


@app.post("/products", response_model=ProductOut)
def create_product(payload: ProductInput, branch_id: int | None = None, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> Product:
    branch = resolve_branch_for_user(db, current_user, branch_id)
    if not db.get(Category, payload.category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    product = Product(branch_id=branch.id)
    apply_product_payload(product, payload, branch.id)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@app.patch("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductInput, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> Product:
    product = (
        db.query(Product)
        .options(joinedload(Product.variants_rel).joinedload(ProductVariant.values))
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    ensure_branch_access(current_user, product.branch_id)
    if not db.get(Category, payload.category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    apply_product_payload(product, payload, product.branch_id)
    db.commit()
    db.refresh(product)
    return product


@app.delete("/products/{product_id}")
def delete_product(product_id: int, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    ensure_branch_access(current_user, product.branch_id)
    if db.query(OrderItem).filter(OrderItem.product_id == product_id).first():
        raise HTTPException(status_code=400, detail="Product cannot be deleted because it is used in orders")
    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}


@app.get("/payment-methods", response_model=list[PaymentMethodOut])
def list_payment_methods(current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[dict]:
    methods = db.query(PaymentMethod).order_by(PaymentMethod.name).all()
    return [payment_method_to_payload(method) for method in methods]


@app.post("/payment-methods", response_model=PaymentMethodOut)
def create_payment_method(payload: PaymentMethodInput, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    if db.query(PaymentMethod).filter(PaymentMethod.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Payment method already exists")
    method = PaymentMethod(
        name=payload.name,
        type=payload.type,
        enabled=payload.enabled,
        is_active=True,
        config_json={"upi_id": payload.upi_id} if payload.upi_id else {},
    )
    db.add(method)
    db.commit()
    db.refresh(method)
    return payment_method_to_payload(method)


@app.patch("/payment-methods/{method_id}", response_model=PaymentMethodOut)
def update_payment_method(method_id: int, payload: PaymentMethodInput, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    method = db.get(PaymentMethod, method_id)
    if not method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    duplicate_method = db.query(PaymentMethod).filter(PaymentMethod.name == payload.name, PaymentMethod.id != method_id).first()
    if duplicate_method:
        raise HTTPException(status_code=400, detail="Payment method already exists")
    method.name = payload.name
    method.type = payload.type
    method.enabled = payload.enabled
    method.config_json = {"upi_id": payload.upi_id} if payload.upi_id else {}
    db.commit()
    db.refresh(method)
    return payment_method_to_payload(method)


@app.delete("/payment-methods/{method_id}")
def delete_payment_method(method_id: int, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    method = db.get(PaymentMethod, method_id)
    if not method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    if db.query(Payment).filter(Payment.payment_method_id == method_id).first():
        raise HTTPException(status_code=400, detail="Payment method cannot be deleted because it is used in payments")
    db.delete(method)
    db.commit()
    return {"message": "Payment method deleted"}


@app.get("/floors", response_model=list[FloorWithTables])
def list_floors(branch_id: int | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Floor]:
    branch = resolve_branch_for_user(db, current_user, branch_id)
    return (
        db.query(Floor)
        .options(joinedload(Floor.tables), joinedload(Floor.branch), joinedload(Floor.tables).joinedload(RestaurantTable.branch))
        .filter(Floor.branch_id == branch.id)
        .order_by(Floor.name)
        .all()
    )


@app.post("/floors", response_model=FloorWithTables)
def create_floor(payload: FloorInput, branch_id: int | None = None, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> Floor:
    branch = resolve_branch_for_user(db, current_user, branch_id)
    if db.query(Floor).filter(Floor.branch_id == branch.id, Floor.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Floor already exists in this branch")
    floor = Floor(branch_id=branch.id, name=payload.name)
    db.add(floor)
    db.commit()
    db.refresh(floor)
    return floor


@app.delete("/floors/{floor_id}")
def delete_floor(floor_id: int, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    floor = db.get(Floor, floor_id)
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    if db.query(RestaurantTable).filter(RestaurantTable.floor_id == floor_id).first():
        raise HTTPException(status_code=400, detail="Floor cannot be deleted while it still has tables")
    db.delete(floor)
    db.commit()
    return {"message": "Floor deleted"}


@app.post("/tables", response_model=TableOut)
def create_table(payload: TableInput, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> RestaurantTable:
    floor = db.get(Floor, payload.floor_id)
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    if not floor.branch_id:
        raise HTTPException(status_code=400, detail="Floor is not linked to a branch")
    if db.query(RestaurantTable).filter(RestaurantTable.branch_id == floor.branch_id, RestaurantTable.table_number == payload.table_number).first():
        raise HTTPException(status_code=400, detail="Table number already exists in this branch")
    table = RestaurantTable(
        branch_id=floor.branch_id,
        floor_id=payload.floor_id,
        table_number=payload.table_number,
        seats=payload.seats,
        active=payload.active,
    )
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@app.patch("/tables/{table_id}", response_model=TableOut)
def update_table(table_id: int, payload: TableInput, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> RestaurantTable:
    table = db.get(RestaurantTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    floor = db.get(Floor, payload.floor_id)
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    if not floor.branch_id:
        raise HTTPException(status_code=400, detail="Floor is not linked to a branch")
    duplicate_table = (
        db.query(RestaurantTable)
        .filter(
            RestaurantTable.branch_id == floor.branch_id,
            RestaurantTable.table_number == payload.table_number,
            RestaurantTable.id != table_id,
        )
        .first()
    )
    if duplicate_table:
        raise HTTPException(status_code=400, detail="Table number already exists in this branch")
    table.branch_id = floor.branch_id
    table.floor_id = payload.floor_id
    table.table_number = payload.table_number
    table.seats = payload.seats
    table.active = payload.active
    db.commit()
    db.refresh(table)
    return table


@app.delete("/tables/{table_id}")
def delete_table(table_id: int, current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    table = db.get(RestaurantTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    if db.query(Order).filter(Order.table_id == table_id).first():
        raise HTTPException(status_code=400, detail="Table cannot be deleted because it is used in orders")
    if db.query(SelfOrderToken).filter(SelfOrderToken.table_id == table_id).first():
        raise HTTPException(status_code=400, detail="Table cannot be deleted because self-order tokens exist for it")
    db.delete(table)
    db.commit()
    return {"message": "Table deleted"}


@app.get("/terminals", response_model=list[TerminalOut])
def list_terminals(branch_id: int | None = None, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> list[dict]:
    branch = resolve_branch_for_user(db, current_user, branch_id)
    open_sessions, last_closing_amounts = terminal_runtime_info(db, branch.id)
    terminals = db.query(POSTerminal).options(joinedload(POSTerminal.branch)).filter(POSTerminal.branch_id == branch.id).order_by(POSTerminal.name).all()
    return [
        {
            "id": terminal.id,
            "branch_id": terminal.branch_id,
            "branch_name": terminal.branch_name,
            "name": terminal.name,
            "location": terminal.location,
            "active": terminal.active,
            "last_closing_sale_amount": last_closing_amounts.get(terminal.id, 0.0),
            "last_open_session_id": open_sessions.get(terminal.id),
            "open_session_id": open_sessions.get(terminal.id),
        }
        for terminal in terminals
    ]


@app.post("/terminals", response_model=TerminalOut)
def create_terminal(payload: TerminalInput, branch_id: int | None = None, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> POSTerminal:
    branch = resolve_branch_for_user(db, current_user, branch_id)
    if db.query(POSTerminal).filter(POSTerminal.branch_id == branch.id, POSTerminal.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Terminal already exists in this branch")
    terminal = POSTerminal(branch_id=branch.id, name=payload.name, location=payload.location, active=payload.active)
    db.add(terminal)
    db.commit()
    db.refresh(terminal)
    return terminal


@app.patch("/terminals/{terminal_id}", response_model=TerminalOut)
def update_terminal(terminal_id: int, payload: TerminalInput, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> POSTerminal:
    terminal = db.get(POSTerminal, terminal_id)
    if not terminal:
        raise HTTPException(status_code=404, detail="Terminal not found")
    ensure_branch_access(current_user, terminal.branch_id)
    duplicate = (
        db.query(POSTerminal)
        .filter(POSTerminal.branch_id == terminal.branch_id, POSTerminal.name == payload.name, POSTerminal.id != terminal_id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Terminal already exists in this branch")
    terminal.name = payload.name
    terminal.location = payload.location
    terminal.active = payload.active
    db.commit()
    db.refresh(terminal)
    return terminal


@app.post("/sessions/open", response_model=SessionOut)
def open_session(payload: SessionOpenInput, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> POSSession:
    terminal = db.get(POSTerminal, payload.terminal_id)
    if not terminal:
        raise HTTPException(status_code=404, detail="Terminal not found")
    if not terminal.branch_id:
        raise HTTPException(status_code=400, detail="Terminal is not linked to a branch")
    ensure_branch_access(current_user, terminal.branch_id)

    existing_open_session = (
        db.query(POSSession)
        .filter(POSSession.terminal_id == payload.terminal_id, POSSession.status == "open")
        .first()
    )
    if existing_open_session:
        raise HTTPException(status_code=400, detail="This terminal already has an open session")
    if not terminal.active:
        raise HTTPException(status_code=400, detail="Terminal is inactive")

    session = POSSession(
        branch_id=terminal.branch_id,
        terminal_id=payload.terminal_id,
        responsible_id=current_user.id,
        opening_amount=Decimal(str(payload.opening_amount)),
        status="open",
        opened_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.post("/sessions/{session_id}/close", response_model=SessionOut)
def close_session(session_id: int, payload: SessionCloseInput, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> POSSession:
    session = db.get(POSSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_branch_access(current_user, session.branch_id)
    if session.status == "closed":
        raise HTTPException(status_code=400, detail="Session is already closed")
    session.status = "closed"
    session.closing_amount = Decimal(str(payload.closing_amount))
    session.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@app.get("/sessions")
def list_sessions(branch_id: int | None = None, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> list[dict]:
    branch = resolve_branch_for_user(db, current_user, branch_id)
    sessions = (
        db.query(POSSession)
        .options(joinedload(POSSession.branch), joinedload(POSSession.responsible))
        .filter(POSSession.branch_id == branch.id)
        .order_by(POSSession.created_at.desc())
        .all()
    )
    return [
        {
            "id": session.id,
            "branch_id": session.branch_id,
            "branch_name": session.branch_name,
            "terminal_id": session.terminal_id,
            "responsible_id": session.responsible_id,
            "responsible_name": session.responsible.name if session.responsible else None,
            "status": session.status,
            "opening_amount": float(session.opening_amount),
            "closing_amount": float(session.closing_amount),
            "opened_at": session.opened_at.isoformat(),
            "closed_at": session.closed_at.isoformat() if session.closed_at else None,
            "created_at": session.created_at.isoformat(),
        }
        for session in sessions
    ]


@app.post("/orders")
def create_order(payload: OrderCreateInput, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> dict:
    session = db.get(POSSession, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_branch_access(current_user, session.branch_id)
    order = build_order(db, payload, responsible_id=current_user.id)
    db.add(order)
    db.commit()
    created = order_query(db).filter(Order.id == order.id).first()
    return serialize_order(created)


@app.get("/orders")
def list_orders(session_id: int | None = None, branch_id: int | None = None, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> list[dict]:
    branch = resolve_branch_for_user(db, current_user, branch_id)
    query = order_query(db).filter(Order.branch_id == branch.id).order_by(Order.created_at.desc())
    if session_id:
        query = query.filter(Order.session_id == session_id)
    return [serialize_order(order) for order in query.all()]


@app.post("/orders/{order_id}/send")
def send_to_kitchen(order_id: int, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> dict:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_branch_access(current_user, order.branch_id)
    if order.status == "completed":
        raise HTTPException(status_code=400, detail="Completed orders cannot be re-sent to kitchen")
    order.status = "sent"
    order.kitchen_status = "to_cook"
    db.commit()
    return {"message": "Order sent to kitchen"}


@app.post("/orders/{order_id}/payments")
def add_payment(order_id: int, payload: PaymentInput, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> dict:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_branch_access(current_user, order.branch_id)
    if order.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Order has already been paid")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")
    expected_amount = round(float(order.grand_total), 2)
    received_amount = round(float(payload.amount), 2)
    if received_amount != expected_amount:
        raise HTTPException(status_code=400, detail=f"Payment amount must match the order total of {expected_amount:.2f}")
    payment_method = resolve_fixed_payment_method(db, payload.payment_method_id, payload.payment_method_code)

    paid_at = datetime.utcnow()
    payment = Payment(
        order_id=order.id,
        payment_method_id=payment_method.id,
        amount=Decimal(str(payload.amount)),
        reference=payload.reference,
        transaction_ref=payload.reference,
        payment_status="confirmed",
        paid_at=paid_at,
    )
    db.add(payment)
    order.payment_status = "paid"
    order.status = "completed"
    order.paid_at = paid_at
    order.closed_at = paid_at
    db.commit()
    refreshed = order_query(db).filter(Order.id == order.id).first()
    return serialize_order(refreshed)


@app.get("/kitchen/orders")
def kitchen_orders(branch_id: int | None = None, db: Session = Depends(get_db)) -> list[dict]:
    branch = resolve_public_branch(db, branch_id)
    orders = (
        order_query(db)
        .filter(Order.branch_id == branch.id, Order.status.in_(["sent", "completed"]))
        .order_by(Order.created_at.desc())
        .all()
    )
    return [serialize_order(order) for order in orders]


@app.post("/kitchen/orders/{order_id}/advance")
def kitchen_advance(order_id: int, branch_id: int | None = None, db: Session = Depends(get_db)) -> dict:
    branch = resolve_public_branch(db, branch_id)
    order = db.get(Order, order_id)
    if not order or order.branch_id != branch.id:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in ["sent", "completed"]:
        raise HTTPException(status_code=400, detail="Only sent orders can be updated in kitchen")
    transitions = {"to_cook": "preparing", "preparing": "completed", "completed": "completed"}
    order.kitchen_status = transitions.get(order.kitchen_status, "to_cook")
    db.commit()
    return {"message": "Kitchen status updated", "kitchen_status": order.kitchen_status}


@app.post("/kitchen/items/{item_id}/toggle")
def kitchen_toggle_item(item_id: int, branch_id: int | None = None, db: Session = Depends(get_db)) -> dict:
    branch = resolve_public_branch(db, branch_id)
    item = db.get(OrderItem, item_id)
    if not item or item.order.branch_id != branch.id:
        raise HTTPException(status_code=404, detail="Item not found")
    item.kitchen_done = not item.kitchen_done
    db.commit()
    return {"message": "Item updated", "kitchen_done": item.kitchen_done}


@app.get("/customer-display/{order_id}")
def customer_display(order_id: int, branch_id: int | None = None, db: Session = Depends(get_db)) -> dict:
    branch = resolve_public_branch(db, branch_id)
    order = order_query(db).filter(Order.id == order_id, Order.branch_id == branch.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return serialize_order(order)


@app.get("/customer-display")
def customer_display_board(branch_id: int | None = None, db: Session = Depends(get_db)) -> list[dict]:
    branch = resolve_public_branch(db, branch_id)
    paid_cutoff = datetime.utcnow() - timedelta(minutes=5)
    orders = (
        order_query(db)
        .filter(
            Order.branch_id == branch.id,
            (((Order.payment_status == "paid") & (Order.updated_at >= paid_cutoff)) | (Order.payment_status != "paid")),
        )
        .order_by(Order.created_at.desc())
        .limit(20)
        .all()
    )
    return [serialize_order(order) for order in orders]


@app.post("/self-order/tokens", response_model=SelfOrderTokenOut)
def create_self_order_token(table_id: int, session_id: int, current_user: User = Depends(require_role("admin", "staff")), db: Session = Depends(get_db)) -> SelfOrderToken:
    session = db.get(POSSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_branch_access(current_user, session.branch_id)
    if session.status != "open":
        raise HTTPException(status_code=400, detail="Self-order tokens require an open session")
    table = db.get(RestaurantTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    if table.branch_id != session.branch_id:
        raise HTTPException(status_code=400, detail="Table does not belong to the session branch")
    (
        db.query(SelfOrderToken)
        .filter(
            SelfOrderToken.table_id == table_id,
            SelfOrderToken.session_id == session_id,
            SelfOrderToken.active.is_(True),
        )
        .update({"active": False}, synchronize_session=False)
    )
    token = SelfOrderToken(
        branch_id=session.branch_id,
        token=token_hex(6),
        table_id=table_id,
        session_id=session_id,
        active=True,
        expires_at=datetime.utcnow() + timedelta(hours=8),
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


@app.get("/self-order/tokens/{token}")
def get_self_order_token(token: str, db: Session = Depends(get_db)) -> dict:
    now = datetime.utcnow()
    self_token = (
        db.query(SelfOrderToken)
        .filter(
            SelfOrderToken.token == token,
            SelfOrderToken.active.is_(True),
            ((SelfOrderToken.expires_at.is_(None)) | (SelfOrderToken.expires_at >= now)),
        )
        .first()
    )
    if not self_token:
        raise HTTPException(status_code=404, detail="Token not found")
    session = db.get(POSSession, self_token.session_id)
    if not session or session.status != "open":
        raise HTTPException(status_code=400, detail="This self-order token is no longer active")
    table = db.get(RestaurantTable, self_token.table_id)
    products = (
        db.query(Product)
        .options(joinedload(Product.branch), joinedload(Product.variants_rel).joinedload(ProductVariant.values))
        .filter(Product.branch_id == self_token.branch_id, Product.is_active.is_(True))
        .order_by(Product.name)
        .all()
    )
    return {
        "token": self_token.token,
        "branch_id": self_token.branch_id,
        "branch_name": self_token.branch_name,
        "table": {"id": table.id, "table_number": table.table_number},
        "products": [ProductOut.model_validate(product).model_dump() for product in products],
    }


@app.post("/self-order")
def submit_self_order(payload: SelfOrderInput, db: Session = Depends(get_db)) -> dict:
    now = datetime.utcnow()
    self_token = (
        db.query(SelfOrderToken)
        .filter(
            SelfOrderToken.token == payload.token,
            SelfOrderToken.active.is_(True),
            ((SelfOrderToken.expires_at.is_(None)) | (SelfOrderToken.expires_at >= now)),
        )
        .first()
    )
    if not self_token:
        raise HTTPException(status_code=404, detail="Token not found")
    session = db.get(POSSession, self_token.session_id)
    if not session or session.status != "open":
        raise HTTPException(status_code=400, detail="This self-order token is no longer active")
    order_payload = OrderCreateInput(
        session_id=self_token.session_id,
        table_id=self_token.table_id,
        source="self",
        notes=payload.notes,
        items=payload.items,
    )
    order = build_order(db, order_payload)
    db.add(order)
    db.commit()
    db.refresh(order)
    return {"message": "Self order placed", "order_number": order.order_number, "order_id": order.id}


@app.get("/reports/branches")
def branch_reports_summary(current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[dict]:
    branches = db.query(Branch).order_by(Branch.name).all()
    summary: list[dict] = []
    for branch in branches:
        orders = db.query(Order).filter(Order.branch_id == branch.id).all()
        paid_orders = [order for order in orders if order.payment_status == "paid"]
        sales = sum(float(order.grand_total) for order in paid_orders)
        summary.append(
            {
                "branch_id": branch.id,
                "branch_name": branch.name,
                "branch_code": branch.code,
                "is_active": branch.is_active,
                "orders": len(orders),
                "paid_orders": len(paid_orders),
                "sales": sales,
                "avg_order_value": round(sales / len(paid_orders), 2) if paid_orders else 0,
                "open_sessions": db.query(POSSession).filter(POSSession.branch_id == branch.id, POSSession.status == "open").count(),
                "users": db.query(User).filter(User.branch_id == branch.id).count(),
                "tables": db.query(RestaurantTable).filter(RestaurantTable.branch_id == branch.id).count(),
            }
        )
    return summary


@app.get("/reports")
def reports(
    period: str | None = None,
    session_id: int | None = None,
    responsible_id: int | None = None,
    product_id: int | None = None,
    branch_id: int | None = None,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> dict:
    branch = resolve_branch_for_user(db, current_user, branch_id)
    query = order_query(db).filter(Order.branch_id == branch.id)
    if session_id:
        query = query.filter(Order.session_id == session_id)
    if responsible_id:
        query = query.filter(Order.responsible_id == responsible_id)
    if product_id:
        query = query.join(OrderItem).filter(OrderItem.product_id == product_id)

    orders = query.all()
    total_sales = sum(float(order.grand_total) for order in orders)
    return {
        "branch": BranchOut.model_validate(branch).model_dump(),
        "filters": {
            "period": period,
            "session_id": session_id,
            "responsible_id": responsible_id,
            "product_id": product_id,
            "branch_id": branch.id,
        },
        "summary": {
            "orders": len(orders),
            "sales": total_sales,
            "avg_order_value": round(total_sales / len(orders), 2) if orders else 0,
        },
        "orders": [serialize_order(order) for order in orders],
    }
