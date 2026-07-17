"""
FastAPI — API v1 con autenticación JWT y Rule Engine genérico.
Todas las plataformas (web, Android, iOS) consumen los mismos endpoints.
Ejecutar: uvicorn api:app --reload --port 8000
"""
import json
import os
import sys
import shutil
from pathlib import Path
from typing import Optional

import psycopg2
from fastapi import Depends, FastAPI, HTTPException, File, UploadFile, Form
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

sys.path.append(str(Path(__file__).parent))

from analyzer import init_db, process_folder, process_single_file, save_cliente
from auth import (
    create_access_token, create_refresh_token, decode_token,
    hash_password, init_auth_tables,
    require_admin, require_admin_analista, require_any, require_staff,
    verify_password,
)
from decision_engine import (
    DEFAULT_CRITERIOS, get_politica_activa, init_decision_db,
    obtener_estadisticas_historicas, save_politica, sugerir_criterios_ia,
)
from models import (
    ActivarReglaRequest, AnalizarRequest, EvaluarRequest,
    LoginRequest, PoliticaLegacyRequest, ReglaNegocioCreate,
    RefreshRequest, TokenResponse, UsuarioCreate,
    SimulacionRequest, ParametrosRiesgoRequest,
)
from amortizacion import generar_tabla_amortizacion, resumen_rapido
from scoring_engine import calcular_scoring_multifuente
from extractor_adres import extraer_adres
from extractor_begini import extraer_begini
from extractor_preselecta import extraer_preselecta
from extractor_runt import extraer_runt
from extractor_digiventure import extraer_digiventure
from rule_engine import sugerir_politica_ia, tomar_decision

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Finalco — Rule Engine API",
    version="2.0.0",
    description="API unificada para web, Android e iOS. Reglas de negocio centralizadas.",
)

ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        dbname=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
    )


def init_sprint2_db(conn):
    try:
        sql_path = Path(__file__).parent / "schema_sprint2.sql"
        if sql_path.exists():
            sql = sql_path.read_text(encoding="utf-8")
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
            print("Base de datos Sprint 2 inicializada correctamente.")
    except Exception as e:
        print(f"Error inicializando base de datos Sprint 2: {e}")


@app.on_event("startup")
async def startup():
    init_db()
    init_decision_db()
    conn = get_db()
    try:
        init_auth_tables(conn)
        init_sprint2_db(conn)
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
# AUTH  /api/v1/auth/
# ════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/auth/login", response_model=TokenResponse, tags=["Auth"])
def login(req: LoginRequest):
    try:
        conn = get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM usuarios WHERE email = %s AND activo = TRUE", (req.email,))
                user = cur.fetchone()
        finally:
            conn.close()

        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(401, "Credenciales incorrectas")

        return {
            "access_token": create_access_token(user["id"], user["email"], user["rol"]),
            "refresh_token": create_refresh_token(user["id"]),
            "token_type": "bearer",
            "rol": user["rol"],
            "nombre": user["nombre"],
        }
    except Exception as e:
        import traceback
        print(f"ERROR LOGIN: {e}")
        traceback.print_exc()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(500, f"Error interno en login: {str(e)}")


@app.post("/api/v1/auth/refresh", tags=["Auth"])
def refresh_token(req: RefreshRequest):
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Refresh token inválido")
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM usuarios WHERE id = %s AND activo = TRUE", (int(payload["sub"]),))
            user = cur.fetchone()
    finally:
        conn.close()
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return {
        "access_token": create_access_token(user["id"], user["email"], user["rol"]),
        "token_type": "bearer",
    }


# ════════════════════════════════════════════════════════════════════════════
# USUARIOS  /api/v1/usuarios/   [Solo Admin]
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/usuarios", tags=["Usuarios"])
def listar_usuarios(_user=Depends(require_admin)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, email, nombre, rol, activo, fecha_creacion FROM usuarios ORDER BY id")
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@app.post("/api/v1/usuarios", tags=["Usuarios"])
def crear_usuario(req: UsuarioCreate, _user=Depends(require_admin)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            try:
                cur.execute(
                    "INSERT INTO usuarios (email, nombre, password_hash, rol) VALUES (%s,%s,%s,%s) RETURNING id",
                    (req.email, req.nombre, hash_password(req.password), req.rol)
                )
                nuevo_id = cur.fetchone()["id"]
                conn.commit()
                return {"id": nuevo_id, "message": "Usuario creado"}
            except psycopg2.IntegrityError:
                conn.rollback()
                raise HTTPException(409, f"El email {req.email} ya existe")
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
# PRODUCTOS  /api/v1/productos/
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/productos", tags=["Productos"])
def listar_productos(_user=Depends(require_any)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM tipos_producto WHERE activo = TRUE ORDER BY id")
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
# REGLAS DE NEGOCIO  /api/v1/reglas/
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/reglas", tags=["Reglas"])
def listar_reglas(tipo: Optional[str] = None, _user=Depends(require_any)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if tipo:
                cur.execute("""
                    SELECT r.*, tp.codigo as tipo_codigo, tp.nombre as tipo_nombre
                    FROM reglas_negocio r JOIN tipos_producto tp ON tp.id = r.tipo_producto_id
                    WHERE tp.codigo = %s ORDER BY r.fecha_creacion DESC
                """, (tipo,))
            else:
                cur.execute("""
                    SELECT r.*, tp.codigo as tipo_codigo, tp.nombre as tipo_nombre
                    FROM reglas_negocio r JOIN tipos_producto tp ON tp.id = r.tipo_producto_id
                    ORDER BY r.fecha_creacion DESC
                """)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@app.post("/api/v1/reglas", tags=["Reglas"])
def crear_regla(req: ReglaNegocioCreate, user=Depends(require_admin)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id FROM tipos_producto WHERE codigo = %s", (req.tipo_producto_codigo,))
            tp = cur.fetchone()
            if not tp:
                raise HTTPException(404, f"Tipo de producto '{req.tipo_producto_codigo}' no existe")
            cur.execute("""
                INSERT INTO reglas_negocio (tipo_producto_id, nombre, descripcion, esquema, creada_por, activa)
                VALUES (%s, %s, %s, %s, %s, FALSE) RETURNING id
            """, (tp["id"], req.nombre, req.descripcion, json.dumps(req.esquema.dict()), user["id"]))
            nueva_id = cur.fetchone()["id"]
            conn.commit()
            return {"id": nueva_id, "message": "Regla creada (inactiva, use /activar para activarla)"}
    finally:
        conn.close()


@app.post("/api/v1/reglas/{regla_id}/activar", tags=["Reglas"])
def activar_regla(regla_id: int, req: ActivarReglaRequest, user=Depends(require_admin)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM reglas_negocio WHERE id = %s", (regla_id,))
            regla = cur.fetchone()
            if not regla:
                raise HTTPException(404, "Regla no encontrada")

            # Desactivar otras del mismo tipo
            cur.execute("""
                UPDATE reglas_negocio SET activa = FALSE
                WHERE tipo_producto_id = %s AND id != %s
            """, (regla["tipo_producto_id"], regla_id))

            # Guardar historial
            cur.execute("""
                INSERT INTO versiones_reglas (regla_id, version, esquema_anterior, esquema_nuevo, modificada_por, motivo)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (regla_id, regla["version"], regla["esquema"], regla["esquema"], user["id"], req.motivo))

            # Activar
            cur.execute("""
                UPDATE reglas_negocio
                SET activa = TRUE, fecha_activacion = NOW(), version = version + 1
                WHERE id = %s
            """, (regla_id,))
            conn.commit()
            return {"message": f"Regla {regla_id} activada correctamente"}
    finally:
        conn.close()


@app.get("/api/v1/reglas/{regla_id}/versiones", tags=["Reglas"])
def historial_regla(regla_id: int, _user=Depends(require_admin_analista)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT v.*, u.nombre as modificado_por_nombre
                FROM versiones_reglas v
                LEFT JOIN usuarios u ON u.id = v.modificada_por
                WHERE v.regla_id = %s ORDER BY v.fecha DESC
            """, (regla_id,))
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@app.get("/api/v1/reglas/sugerir/{tipo_producto}", tags=["Reglas"])
def sugerir_regla(tipo_producto: str, _user=Depends(require_admin_analista)):
    stats = obtener_estadisticas_historicas()
    return sugerir_politica_ia(stats or {}, tipo_producto)


# ════════════════════════════════════════════════════════════════════════════
# CLIENTES  /api/v1/clientes/
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/clientes", tags=["Clientes"])
def listar_clientes(skip: int = 0, limit: int = 100, buscar: str = "", q: str = "",
                    _user=Depends(require_staff)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            term = buscar or q
            like = f"%{term}%"
            cur.execute("""
                SELECT c.*,
                       d.decision, d.monto_aprobado, d.tasa_interes,
                       d.plazo_meses, d.score_decision, d.fecha_decision
                FROM clientes_credito c
                LEFT JOIN LATERAL (
                    SELECT * FROM decisiones_credito
                    WHERE cliente_id = c.id
                    ORDER BY fecha_decision DESC LIMIT 1
                ) d ON TRUE
                WHERE (%s = '' OR c.nombre ILIKE %s OR c.cedula ILIKE %s)
                ORDER BY c.fecha_analisis DESC
                LIMIT %s OFFSET %s
            """, (term, like, like, limit, skip))
            rows = [dict(r) for r in cur.fetchall()]
            cur.execute(
                "SELECT COUNT(*) FROM clientes_credito WHERE (%s='' OR nombre ILIKE %s OR cedula ILIKE %s)",
                (term, like, like)
            )
            total = cur.fetchone()["count"]
        return {"items": rows, "total": total}
    finally:
        conn.close()


@app.get("/api/v1/clientes/{cliente_id}", tags=["Clientes"])
def obtener_cliente(cliente_id: int, _user=Depends(require_any)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM clientes_credito WHERE id = %s", (cliente_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Cliente no encontrado")
            cur.execute(
                "SELECT * FROM decisiones_credito WHERE cliente_id = %s ORDER BY fecha_decision DESC",
                (cliente_id,)
            )
            decisiones = [dict(d) for d in cur.fetchall()]
            cur.execute(
                "SELECT * FROM documentos_procesados WHERE cliente_id = %s",
                (cliente_id,)
            )
            documentos = [dict(d) for d in cur.fetchall()]
        return {**dict(row), "decisiones": decisiones, "documentos": documentos}
    finally:
        conn.close()


@app.post("/api/v1/clientes/{cliente_id}/evaluar", tags=["Clientes"])
def evaluar_cliente(cliente_id: int, req: EvaluarRequest, user=Depends(require_admin_analista)):
    try:
        return tomar_decision(
            cliente_id=cliente_id,
            monto_solicitado=req.monto_solicitado,
            regla_id=req.regla_id,
            tipo_producto_codigo=req.tipo_producto_codigo or "credito",
            usuario_id=user["id"],
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/v1/analizar", tags=["Clientes"])
def analizar_carpeta(req: AnalizarRequest, _user=Depends(require_staff)):
    from pathlib import Path as P
    carpeta = P(req.carpeta)
    if not carpeta.exists():
        raise HTTPException(400, f"La carpeta no existe: {req.carpeta}")
    result = process_folder(str(carpeta))
    if not result:
        raise HTTPException(422, "No se pudo procesar la carpeta")
    return result


@app.post("/api/v1/analizar-archivo", tags=["Clientes"])
async def analizar_archivo(file: UploadFile = File(...), _user=Depends(require_staff)):
    # Crear carpeta temporal si no existe
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    file_path = upload_dir / file.filename
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        result = process_single_file(str(file_path))
        if not result:
            raise HTTPException(422, "No se pudo procesar el archivo")
        return result
    except Exception as e:
        import traceback
        print(f"ERROR ANALIZAR: {e}")
        traceback.print_exc()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(500, f"Error procesando archivo: {str(e)}")
    finally:
        # Opcional: borrar archivo después de procesar o guardarlo en una carpeta de cliente definitiva
        pass


@app.post("/api/v1/clientes", tags=["Clientes"])
def guardar_cliente(data: dict, _user=Depends(require_staff)):
    try:
        # doc_names y docs_info podrían venir vacíos si es creación manual
        cliente_id = save_cliente(data, [], [])
        return {"id": cliente_id, "message": "Cliente guardado exitosamente"}
    except Exception as e:
        raise HTTPException(500, f"Error al guardar cliente: {str(e)}")


# ════════════════════════════════════════════════════════════════════════════
# DECISIONES  /api/v1/decisiones/
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/decisiones", tags=["Decisiones"])
def listar_decisiones(skip: int = 0, limit: int = 100, _user=Depends(require_staff)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT d.*, c.nombre, c.cedula, c.nivel_riesgo,
                       c.score_datacredito, c.score_cifin
                FROM decisiones_credito d
                JOIN clientes_credito c ON c.id = d.cliente_id
                ORDER BY d.fecha_decision DESC
                LIMIT %s OFFSET %s
            """, (limit, skip))
            rows = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT COUNT(*) FROM decisiones_credito")
            total = cur.fetchone()["count"]
        return {"items": rows, "total": total}
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
# STATS  /api/v1/stats/
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/stats", tags=["Stats"])
def estadisticas(_user=Depends(require_admin_analista)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT COUNT(*) as total_clientes,
                       AVG(score_datacredito) as avg_score_dc,
                       AVG(score_cifin) as avg_score_cifin,
                       AVG(endeudamiento_datacredito) as avg_endeudamiento,
                       SUM(CASE WHEN es_confiable THEN 1 ELSE 0 END) as confiables,
                       COUNT(CASE WHEN nivel_riesgo='bajo' THEN 1 END) as riesgo_bajo,
                       COUNT(CASE WHEN nivel_riesgo='medio' THEN 1 END) as riesgo_medio,
                       COUNT(CASE WHEN nivel_riesgo='alto' THEN 1 END) as riesgo_alto
                FROM clientes_credito
            """)
            clientes_stats = dict(cur.fetchone())
            cur.execute("""
                SELECT COUNT(*) as total_decisiones,
                       SUM(CASE WHEN decision='aprobado' THEN 1 ELSE 0 END) as aprobadas,
                       SUM(CASE WHEN decision='rechazado' THEN 1 ELSE 0 END) as rechazadas,
                       SUM(CASE WHEN decision='revision_manual' THEN 1 ELSE 0 END) as en_revision,
                       SUM(monto_aprobado) as monto_total_aprobado,
                       AVG(tasa_interes) as tasa_promedio
                FROM decisiones_credito
            """)
            decision_stats = dict(cur.fetchone())
            cur.execute("""
                SELECT DATE(fecha_decision) as fecha, decision, COUNT(*) as total
                FROM decisiones_credito
                WHERE fecha_decision >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(fecha_decision), decision
                ORDER BY fecha
            """)
            tendencia = [dict(r) for r in cur.fetchall()]
        return {
            "clientes": {k: float(v) if v is not None else 0 for k, v in clientes_stats.items()},
            "decisiones": {k: float(v) if v is not None else 0 for k, v in decision_stats.items()},
            "tendencia": tendencia,
        }
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
# LEGACY  /api/  — compatibilidad con frontend web actual
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/clientes")
def listar_clientes_legacy(skip: int = 0, limit: int = 100, buscar: str = "", q: str = ""):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            term = buscar or q
            like = f"%{term}%"
            cur.execute("""
                SELECT c.*, d.decision, d.monto_aprobado, d.tasa_interes,
                       d.plazo_meses, d.score_decision, d.fecha_decision
                FROM clientes_credito c
                LEFT JOIN LATERAL (
                    SELECT * FROM decisiones_credito WHERE cliente_id=c.id
                    ORDER BY fecha_decision DESC LIMIT 1
                ) d ON TRUE
                WHERE (%s='' OR c.nombre ILIKE %s OR c.cedula ILIKE %s)
                ORDER BY c.fecha_analisis DESC LIMIT %s OFFSET %s
            """, (term, like, like, limit, skip))
            rows = [dict(r) for r in cur.fetchall()]
            cur.execute(
                "SELECT COUNT(*) FROM clientes_credito WHERE (%s='' OR nombre ILIKE %s OR cedula ILIKE %s)",
                (term, like, like)
            )
            total = cur.fetchone()["count"]
        return {"items": rows, "total": total}
    finally:
        conn.close()


@app.get("/api/clientes/{cliente_id}")
def obtener_cliente_legacy(cliente_id: int):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM clientes_credito WHERE id = %s", (cliente_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Cliente no encontrado")
            cur.execute("SELECT * FROM decisiones_credito WHERE cliente_id=%s ORDER BY fecha_decision DESC", (cliente_id,))
            decisiones = [dict(d) for d in cur.fetchall()]
            cur.execute("SELECT * FROM documentos_procesados WHERE cliente_id=%s", (cliente_id,))
            documentos = [dict(d) for d in cur.fetchall()]
        return {**dict(row), "decisiones": decisiones, "documentos": documentos}
    finally:
        conn.close()


@app.post("/api/analizar")
def analizar_legacy(req: AnalizarRequest):
    from pathlib import Path as P
    carpeta = P(req.carpeta)
    if not carpeta.exists():
        raise HTTPException(400, f"La carpeta no existe: {req.carpeta}")
    result = process_folder(str(carpeta))
    if not result:
        raise HTTPException(422, "No se pudo procesar la carpeta")
    return result


@app.post("/api/clientes/{cliente_id}/decidir")
def decidir_legacy(cliente_id: int, req: EvaluarRequest):
    try:
        return tomar_decision(cliente_id, req.monto_solicitado, req.regla_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/decisiones")
def decisiones_legacy(skip: int = 0, limit: int = 100):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT d.*, c.nombre, c.cedula, c.nivel_riesgo, c.score_datacredito, c.score_cifin
                FROM decisiones_credito d JOIN clientes_credito c ON c.id=d.cliente_id
                ORDER BY d.fecha_decision DESC LIMIT %s OFFSET %s
            """, (limit, skip))
            rows = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT COUNT(*) FROM decisiones_credito")
            total = cur.fetchone()["count"]
        return {"items": rows, "total": total}
    finally:
        conn.close()


@app.get("/api/politica")
def politica_legacy():
    pol = get_politica_activa()
    return {**(dict(pol) if pol else {}), "activa": bool(pol), "criterios": pol["criterios"] if pol else DEFAULT_CRITERIOS}


@app.post("/api/politica")
def crear_politica_legacy(req: PoliticaLegacyRequest):
    pid = save_politica(req.nombre, req.descripcion, req.criterios, req.creada_por)
    return {"id": pid, "message": "Política guardada y activada"}


@app.get("/api/politica/sugerir")
def sugerir_legacy():
    stats = obtener_estadisticas_historicas()
    if not stats or stats.get("total", 0) < 2:
        return {"criterios": DEFAULT_CRITERIOS, "justificacion": "Datos insuficientes.", "advertencias": []}
    try:
        return sugerir_criterios_ia(stats)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/stats")
def stats_legacy():
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT COUNT(*) as total_clientes, AVG(score_datacredito) as avg_score_dc,
                       AVG(score_cifin) as avg_score_cifin, AVG(endeudamiento_datacredito) as avg_endeudamiento,
                       SUM(CASE WHEN es_confiable THEN 1 ELSE 0 END) as confiables,
                       COUNT(CASE WHEN nivel_riesgo='bajo' THEN 1 END) as riesgo_bajo,
                       COUNT(CASE WHEN nivel_riesgo='medio' THEN 1 END) as riesgo_medio,
                       COUNT(CASE WHEN nivel_riesgo='alto' THEN 1 END) as riesgo_alto
                FROM clientes_credito
            """)
            clientes_stats = dict(cur.fetchone())
            cur.execute("""
                SELECT COUNT(*) as total_decisiones,
                       SUM(CASE WHEN decision='aprobado' THEN 1 ELSE 0 END) as aprobadas,
                       SUM(CASE WHEN decision='rechazado' THEN 1 ELSE 0 END) as rechazadas,
                       SUM(CASE WHEN decision='revision_manual' THEN 1 ELSE 0 END) as en_revision,
                       SUM(monto_aprobado) as monto_total_aprobado, AVG(tasa_interes) as tasa_promedio
                FROM decisiones_credito
            """)
            decision_stats = dict(cur.fetchone())
            cur.execute("""
                SELECT DATE(fecha_decision) as fecha, decision, COUNT(*) as total
                FROM decisiones_credito WHERE fecha_decision >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(fecha_decision), decision ORDER BY fecha
            """)
            tendencia = [dict(r) for r in cur.fetchall()]
        return {
            "clientes": {k: float(v) if v is not None else 0 for k, v in clientes_stats.items()},
            "decisiones": {k: float(v) if v is not None else 0 for k, v in decision_stats.items()},
            "tendencia": tendencia,
        }
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
# SPRINT 2: SIMULADOR  /api/v1/simulacion/
# ════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/simulacion", tags=["Sprint 2 — Simulador"])
def simular_credito(req: SimulacionRequest, _user=Depends(require_staff)):
    """Genera tabla de amortización completa (Sistema Francés)."""
    # Obtener tasa del parametrizador si no se provee
    tasa_ea = req.tasa_ea
    if tasa_ea is None:
        conn = get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT tasa_ea FROM parametros_riesgo WHERE activo = TRUE LIMIT 1")
                row = cur.fetchone()
                tasa_ea = float(row["tasa_ea"]) if row else 0.2426
        finally:
            conn.close()

    result = generar_tabla_amortizacion(
        monto=req.monto,
        plazo_meses=req.plazo_meses,
        tasa_ea=tasa_ea,
        seguro_vida_pct=req.seguro_vida_pct or 0.0,
        fianza_pct=req.fianza_pct or 0.0,
        gastos_tecnologia=req.gastos_tecnologia or 0.0,
        iva_pct=req.iva_pct or 0.19,
    )

    # Guardar en BD si hay cliente_id
    sim_id = None
    if req.cliente_id:
        conn = get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO simulaciones (cliente_id, monto, plazo_meses, tasa_ea,
                        tasa_mensual, cuota_fija, total_a_pagar, tabla_amortizacion, resumen, creado_por)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
                    RETURNING id
                """, (
                    req.cliente_id, req.monto, req.plazo_meses, tasa_ea,
                    result["resumen"]["tasa_mensual_pct"] / 100,
                    result["resumen"]["cuota_fija_base"],
                    result["resumen"]["gran_total"],
                    json.dumps(result["tabla"]),
                    json.dumps(result["resumen"]),
                    _user.get("id"),
                ))
                sim_id = cur.fetchone()["id"]
            conn.commit()
        except Exception:
            pass  # No bloquear si falla el guardado
        finally:
            conn.close()

    return {"id": sim_id, "resumen": result["resumen"], "tabla": result["tabla"]}


@app.get("/api/v1/simulacion/rapida", tags=["Sprint 2 — Simulador"])
def simulacion_rapida(monto: float, plazo: int, tasa_ea: float = 0.2426):
    """Preview rápido de cuota estimada sin tabla completa (no requiere auth)."""
    return resumen_rapido(monto, plazo, tasa_ea)


@app.get("/api/v1/simulacion/{sim_id}", tags=["Sprint 2 — Simulador"])
def obtener_simulacion(sim_id: int, _user=Depends(require_staff)):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM simulaciones WHERE id = %s", (sim_id,))
            sim = cur.fetchone()
        if not sim:
            raise HTTPException(404, "Simulación no encontrada")
        return dict(sim)
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
# SPRINT 2: SCORING  /api/v1/clientes/{id}/scoring
# ════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/clientes/{cliente_id}/scoring", tags=["Sprint 2 — Scoring"])
def calcular_scoring(cliente_id: int, _user=Depends(require_admin_analista)):
    """Calcula scoring multi-fuente para un cliente (4 ejes + ajustes)."""
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM clientes_credito WHERE id = %s", (cliente_id,))
            cliente = cur.fetchone()
        if not cliente:
            raise HTTPException(404, "Cliente no encontrado")

        # Preparar datos para el scoring engine
        datos = dict(cliente)

        # Obtener parámetros activos
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM parametros_riesgo WHERE activo = TRUE LIMIT 1")
            params = cur.fetchone()

        pesos = None
        bandas = None
        if params:
            pesos = {
                "capacidad": params.get("peso_capacidad", 30),
                "comportamiento": params.get("peso_comportamiento", 30),
                "flujo": params.get("peso_flujo", 20),
                "entorno": params.get("peso_entorno", 8),
            }
            bandas = {
                "A": params.get("banda_a_corte", 80),
                "B": params.get("banda_b_corte", 65),
                "C": params.get("banda_c_corte", 50),
                "C-": params.get("banda_c_menos_corte", 40),
                "D": 0,
            }

        resultado = calcular_scoring_multifuente(datos, pesos=pesos, bandas=bandas)

        # Guardar en BD
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO scoring_multifuente
                    (cliente_id, puntaje_base, puntaje_final, banda, decision, ejes, ajustes, pesos_usados, bandas_usadas)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb)
                RETURNING id
            """, (
                cliente_id, resultado["puntaje_base"], resultado["puntaje_final"],
                resultado["banda"], resultado["decision"],
                json.dumps(resultado["ejes"]), json.dumps(resultado["ajustes"]),
                json.dumps(resultado.get("pesos_usados")), json.dumps(resultado.get("bandas_usadas")),
            ))
            scoring_id = cur.fetchone()["id"]
        conn.commit()

        resultado["id"] = scoring_id
        return resultado
    finally:
        conn.close()


@app.get("/api/v1/clientes/{cliente_id}/scoring", tags=["Sprint 2 — Scoring"])
def obtener_scoring(cliente_id: int, _user=Depends(require_staff)):
    """Obtiene el scoring más reciente de un cliente."""
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM scoring_multifuente
                WHERE cliente_id = %s ORDER BY fecha_scoring DESC LIMIT 1
            """, (cliente_id,))
            scoring = cur.fetchone()
        if not scoring:
            return {"puntaje_final": None, "banda": None, "decision": None, "mensaje": "Sin scoring calculado"}
        return dict(scoring)
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
# SPRINT 2: PARAMETRIZADOR  /api/v1/parametros-riesgo
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/parametros-riesgo", tags=["Sprint 2 — Parametrizador"])
def obtener_parametros(_user=Depends(require_admin_analista)):
    """Obtiene la configuración activa del parametrizador."""
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM parametros_riesgo WHERE activo = TRUE LIMIT 1")
            params = cur.fetchone()
        if not params:
            return {"mensaje": "No hay configuración activa. Ejecute schema_sprint2.sql"}
        result = dict(params)
        # Convert Decimal to float for JSON serialization
        for k, v in result.items():
            if hasattr(v, 'as_integer_ratio'):
                result[k] = float(v)
        return result
    finally:
        conn.close()


@app.put("/api/v1/parametros-riesgo", tags=["Sprint 2 — Parametrizador"])
def actualizar_parametros(req: ParametrosRiesgoRequest, _user=Depends(require_admin)):
    """Actualiza la configuración del parametrizador (solo Admin)."""
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Obtener configuración actual
            cur.execute("SELECT * FROM parametros_riesgo WHERE activo = TRUE LIMIT 1")
            current = cur.fetchone()
            if not current:
                raise HTTPException(404, "No hay configuración activa")

            # Construir SET dinámicamente con solo los campos proporcionados
            updates = {}
            for field, value in req.dict(exclude_none=True).items():
                if field in current and current[field] != value:
                    updates[field] = value
                    # Registrar cambio en historial
                    cur.execute("""
                        INSERT INTO historial_parametros
                            (parametro_id, campo_modificado, valor_anterior, valor_nuevo, modificado_por)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (current["id"], field, str(current[field]), str(value), _user.get("id")))

            if updates:
                set_clause = ", ".join(f"{k} = %s" for k in updates)
                values = list(updates.values())
                cur.execute(
                    f"UPDATE parametros_riesgo SET {set_clause}, fecha_modificacion = NOW() WHERE id = %s",
                    values + [current["id"]]
                )
                conn.commit()
                return {"mensaje": f"{len(updates)} parámetro(s) actualizado(s)", "campos": list(updates.keys())}
            else:
                return {"mensaje": "Sin cambios"}
    finally:
        conn.close()


@app.get("/api/v1/parametros-riesgo/historial", tags=["Sprint 2 — Parametrizador"])
def historial_parametros(_user=Depends(require_admin)):
    """Obtiene el historial de cambios del parametrizador."""
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT hp.*, u.nombre as modificado_por_nombre
                FROM historial_parametros hp
                LEFT JOIN usuarios u ON hp.modificado_por = u.id
                ORDER BY hp.fecha DESC LIMIT 50
            """)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
# SPRINT 2: CARGA DOCUMENTAL  /api/v1/documentos/
# ════════════════════════════════════════════════════════════════════════════

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


@app.post("/api/v1/documentos/cargar", tags=["Sprint 2 — Carga Documental"])
async def cargar_documentos(
    files: List[UploadFile] = File(...),
    cliente_id: Optional[int] = Form(None),
    cedula: Optional[str] = Form(None),
    _user=Depends(require_staff),
):
    """Carga múltiple de PDFs/XLSX por cliente."""
    resultados = []
    import pdfplumber

    for file in files:
        fname = file.filename or "unknown"
        ext = Path(fname).suffix.lower()

        if ext not in (".pdf", ".xlsx", ".xls"):
            resultados.append({"archivo": fname, "error": f"Tipo no soportado: {ext}"})
            continue

        # Guardar archivo temporalmente
        dest = UPLOAD_DIR / fname
        content = await file.read()
        dest.write_bytes(content)

        try:
            # Determinar tipo de documento por nombre
            fname_lower = fname.lower()
            tipo = "desconocido"
            datos = {}

            if "adres" in fname_lower:
                tipo = "adres"
                with pdfplumber.open(str(dest)) as pdf:
                    texto = "\n".join(p.extract_text() or "" for p in pdf.pages)
                datos = extraer_adres(texto, fname)

            elif "begini" in fname_lower:
                tipo = "begini"
                with pdfplumber.open(str(dest)) as pdf:
                    texto = "\n".join(p.extract_text() or "" for p in pdf.pages)
                datos = extraer_begini(texto, fname)

            elif "preselecta" in fname_lower:
                tipo = "preselecta"
                with pdfplumber.open(str(dest)) as pdf:
                    texto = "\n".join(p.extract_text() or "" for p in pdf.pages)
                datos = extraer_preselecta(texto, fname)

            elif "runt" in fname_lower:
                tipo = "runt"
                with pdfplumber.open(str(dest)) as pdf:
                    texto = "\n".join(p.extract_text() or "" for p in pdf.pages)
                datos = extraer_runt(texto, fname)

            elif fname_lower.startswith("dg_") or "digiventure" in fname_lower:
                tipo = "digiventure"
                datos = extraer_digiventure(str(dest))

            elif "pn-" in fname_lower or "pn_" in fname_lower:
                tipo = "datacredito"
                with pdfplumber.open(str(dest)) as pdf:
                    texto = "\n".join(p.extract_text() or "" for p in pdf.pages)
                datos = {"texto_raw": texto[:500], "tipo": "datacredito"}

            elif "cc_" in fname_lower or "cedula" in fname_lower:
                tipo = "cedula"
                datos = {"tipo": "cedula", "archivo": fname}

            resultados.append({
                "archivo": fname,
                "tipo": tipo,
                "datos": datos,
                "ok": True,
            })
        except Exception as e:
            resultados.append({"archivo": fname, "tipo": tipo, "error": str(e), "ok": False})

    return {
        "total_archivos": len(files),
        "procesados": sum(1 for r in resultados if r.get("ok")),
        "errores": sum(1 for r in resultados if not r.get("ok")),
        "resultados": resultados,
    }
