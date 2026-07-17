import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import psycopg2
from psycopg2.extras import RealDictCursor

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "finalco-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8
REFRESH_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "clientes_credito"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
    )


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, email: str, rol: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "email": email, "rol": rol, "exp": expire, "type": "access"},
        SECRET_KEY, algorithm=ALGORITHM,
    )


def create_refresh_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire, "type": "refresh"},
        SECRET_KEY, algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token requerido")
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de acceso requerido")
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, email, nombre, rol, activo FROM usuarios WHERE id = %s", (int(payload["sub"]),))
            user = cur.fetchone()
    finally:
        conn.close()
    if not user or not user["activo"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado o inactivo")
    return dict(user)


def require_roles(*roles):
    """Returns a FastAPI dependency that enforces one of the given roles."""
    def _check(user: dict = Depends(get_current_user)):
        if user["rol"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol '{user['rol']}' no tiene permiso para esta acción"
            )
        return user
    return _check


require_admin            = require_roles("admin")
require_admin_analista   = require_roles("admin", "analista")
require_staff            = require_roles("admin", "analista", "asesor")
require_any              = require_roles("admin", "analista", "asesor", "cliente")


def init_auth_tables(conn):
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id             SERIAL PRIMARY KEY,
                email          TEXT UNIQUE NOT NULL,
                nombre         TEXT NOT NULL,
                password_hash  TEXT NOT NULL,
                rol            TEXT CHECK (rol IN ('admin','analista','asesor','cliente')) NOT NULL,
                activo         BOOLEAN DEFAULT TRUE,
                fecha_creacion TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS tipos_producto (
                id          SERIAL PRIMARY KEY,
                codigo      TEXT UNIQUE NOT NULL,
                nombre      TEXT NOT NULL,
                descripcion TEXT,
                activo      BOOLEAN DEFAULT TRUE
            );

            CREATE TABLE IF NOT EXISTS reglas_negocio (
                id               SERIAL PRIMARY KEY,
                tipo_producto_id INTEGER REFERENCES tipos_producto(id),
                nombre           TEXT NOT NULL,
                descripcion      TEXT,
                version          INTEGER DEFAULT 1,
                activa           BOOLEAN DEFAULT FALSE,
                esquema          JSONB NOT NULL,
                creada_por       INTEGER REFERENCES usuarios(id),
                fecha_creacion   TIMESTAMP DEFAULT NOW(),
                fecha_activacion TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS versiones_reglas (
                id               SERIAL PRIMARY KEY,
                regla_id         INTEGER REFERENCES reglas_negocio(id),
                version          INTEGER NOT NULL,
                esquema_anterior JSONB,
                esquema_nuevo    JSONB,
                modificada_por   INTEGER REFERENCES usuarios(id),
                fecha            TIMESTAMP DEFAULT NOW(),
                motivo           TEXT
            );
        """)
        # Seed default admin users if they don't exist
        default_users = [
            ("admin@finalco.com.co", "Administrador", "admin1234", "admin"),
            ("alvaro_pito@hotmail.com", "Alvaro Pito", "123456", "admin")
        ]
        for email, nombre, pwd, rol in default_users:
            cur.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
            if not cur.fetchone():
                cur.execute(
                    "INSERT INTO usuarios (email, nombre, password_hash, rol) VALUES (%s, %s, %s, %s)",
                    (email, nombre, hash_password(pwd), rol)
                )
        # Seed product types
        cur.execute("SELECT COUNT(*) FROM tipos_producto")
        if cur.fetchone()[0] == 0:
            products = [
                ("credito",    "Libre Inversión",    "Crédito de libre destinación"),
                ("libranza",   "Libranza",            "Crédito por descuento de nómina"),
                ("microcredito","Microcrédito",       "Crédito para microempresarios"),
                ("comercial",  "Crédito Comercial",  "Crédito para empresas"),
                ("cobranza",   "Cobranza",            "Reglas de gestión de cartera"),
                ("seguro",     "Seguros",             "Reglas de elegibilidad para seguros"),
            ]
            cur.executemany(
                "INSERT INTO tipos_producto (codigo, nombre, descripcion) VALUES (%s, %s, %s)",
                products
            )
    conn.commit()
