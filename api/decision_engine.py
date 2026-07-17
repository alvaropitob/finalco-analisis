"""
Motor de decisión crediticia con IA
- Sugiere criterios basados en datos históricos
- Aplica reglas parametrizables
- Decide: Aprobar/Rechazar + monto + tasa + plazo
"""

import os
import json
import logging
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import anthropic

log = logging.getLogger(__name__)

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "dbname": os.getenv("DB_NAME", "clientes_credito"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ──────────────────────────────────────────────
# SCHEMA DB
# ──────────────────────────────────────────────
INIT_SQL = """
CREATE TABLE IF NOT EXISTS politica_credito (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    activa          BOOLEAN DEFAULT TRUE,
    criterios       JSONB NOT NULL,
    creada_por      TEXT DEFAULT 'sistema',
    fecha_creacion  TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decisiones_credito (
    id                  SERIAL PRIMARY KEY,
    cliente_id          INTEGER REFERENCES clientes_credito(id) ON DELETE CASCADE,
    politica_id         INTEGER REFERENCES politica_credito(id),
    decision            TEXT CHECK (decision IN ('aprobado','rechazado','revision_manual')),
    monto_solicitado    NUMERIC(15,2),
    monto_aprobado      NUMERIC(15,2),
    tasa_interes        NUMERIC(5,2),
    plazo_meses         INTEGER,
    score_decision      INTEGER,
    motivos_rechazo     TEXT[],
    condiciones         TEXT[],
    justificacion_ia    TEXT,
    fecha_decision      TIMESTAMP DEFAULT NOW(),
    revisado_por        TEXT,
    estado_final        TEXT DEFAULT 'pendiente'
);

CREATE INDEX IF NOT EXISTS idx_decisiones_cliente ON decisiones_credito(cliente_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_fecha ON decisiones_credito(fecha_decision);
"""


def init_decision_db():
    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cur:
            cur.execute(INIT_SQL)
        conn.commit()
    log.info("Tablas de decisión crediticia creadas.")


# ──────────────────────────────────────────────
# CRITERIOS DEFAULT
# ──────────────────────────────────────────────
DEFAULT_CRITERIOS = {
    "score_datacredito_minimo": 550,
    "score_cifin_minimo": 500,
    "endeudamiento_maximo_pct": 60.0,
    "obligaciones_cifin_maximas": 5,
    "requiere_confiable": True,
    "niveles_riesgo_permitidos": ["bajo", "medio"],
    "monto_maximo_base": 50_000_000,
    "monto_minimo": 500_000,
    "tasa_base_anual_pct": 24.0,
    "ajuste_tasa_riesgo_medio_pct": 4.0,
    "plazo_maximo_meses": 60,
    "plazo_minimo_meses": 3,
    "factor_capacidad_pago": 0.30,
}


def get_politica_activa() -> Optional[dict]:
    try:
        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM politica_credito WHERE activa = TRUE ORDER BY fecha_creacion DESC LIMIT 1"
                )
                row = cur.fetchone()
                return dict(row) if row else None
    except Exception:
        return None


def save_politica(nombre: str, descripcion: str, criterios: dict, creada_por: str = "usuario") -> int:
    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cur:
            # Desactivar anteriores
            cur.execute("UPDATE politica_credito SET activa = FALSE")
            cur.execute(
                """
                INSERT INTO politica_credito (nombre, descripcion, criterios, creada_por, activa)
                VALUES (%s, %s, %s, %s, TRUE) RETURNING id
                """,
                (nombre, descripcion, json.dumps(criterios), creada_por),
            )
            pid = cur.fetchone()[0]
        conn.commit()
    return pid


# ──────────────────────────────────────────────
# IA: SUGERIR CRITERIOS
# ──────────────────────────────────────────────
def sugerir_criterios_ia(stats: dict) -> dict:
    """
    Llama a Claude con estadísticas históricas y pide criterios óptimos.
    Devuelve un dict con criterios sugeridos + justificación.
    """
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"""Eres un experto en riesgo crediticio para una entidad financiera colombiana.
Analiza estas estadísticas históricas de clientes y sugiere criterios óptimos para la política de crédito.

ESTADÍSTICAS HISTÓRICAS:
{json.dumps(stats, ensure_ascii=False, indent=2)}

Responde ÚNICAMENTE con un JSON con esta estructura exacta (sin markdown, sin texto extra):
{{
  "criterios": {{
    "score_datacredito_minimo": número entero,
    "score_cifin_minimo": número entero,
    "endeudamiento_maximo_pct": número decimal,
    "obligaciones_cifin_maximas": número entero,
    "requiere_confiable": true/false,
    "niveles_riesgo_permitidos": ["bajo"] o ["bajo","medio"],
    "monto_maximo_base": número en pesos colombianos,
    "monto_minimo": número en pesos colombianos,
    "tasa_base_anual_pct": número decimal (tasa efectiva anual en %),
    "ajuste_tasa_riesgo_medio_pct": número decimal (puntos adicionales para riesgo medio),
    "plazo_maximo_meses": número entero,
    "plazo_minimo_meses": número entero,
    "factor_capacidad_pago": número decimal entre 0.25 y 0.40
  }},
  "justificacion": "explicación de 3-4 oraciones de los criterios sugeridos basada en los datos",
  "advertencias": ["lista de posibles riesgos o aspectos a considerar"]
}}"""

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip().replace("```json", "").replace("```", "")
    return json.loads(raw)


def obtener_estadisticas_historicas() -> dict:
    """Calcula estadísticas de la BD para alimentar la IA."""
    try:
        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT
                        COUNT(*) as total,
                        AVG(score_datacredito) as avg_score_dc,
                        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY score_datacredito) as p25_dc,
                        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY score_datacredito) as p50_dc,
                        MIN(score_datacredito) as min_dc,
                        MAX(score_datacredito) as max_dc,
                        AVG(score_cifin) as avg_score_cifin,
                        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY score_cifin) as p25_cifin,
                        AVG(endeudamiento_datacredito) as avg_endeud,
                        MAX(endeudamiento_datacredito) as max_endeud,
                        AVG(obligaciones_cifin) as avg_oblig,
                        SUM(CASE WHEN es_confiable THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as pct_confiables,
                        COUNT(CASE WHEN nivel_riesgo = 'bajo' THEN 1 END) as riesgo_bajo,
                        COUNT(CASE WHEN nivel_riesgo = 'medio' THEN 1 END) as riesgo_medio,
                        COUNT(CASE WHEN nivel_riesgo = 'alto' THEN 1 END) as riesgo_alto
                    FROM clientes_credito
                """)
                row = dict(cur.fetchone())
                # Convertir Decimal a float para JSON
                return {k: float(v) if v is not None else None for k, v in row.items()}
    except Exception as e:
        log.error(f"Error obteniendo estadísticas: {e}")
        return {}


# ──────────────────────────────────────────────
# MOTOR DE DECISIÓN
# ──────────────────────────────────────────────
def calcular_score_decision(cliente: dict, criterios: dict) -> tuple[int, list, list]:
    """
    Calcula un score interno de decisión (0-100), lista de rechazos y condiciones.
    """
    score = 100
    rechazos = []
    condiciones = []

    dc = cliente.get("score_datacredito") or 0
    cf = cliente.get("score_cifin") or 0
    endeud = float(cliente.get("endeudamiento_datacredito") or 0)
    oblig = cliente.get("obligaciones_cifin") or 0
    confiable = cliente.get("es_confiable", False)
    riesgo = cliente.get("nivel_riesgo", "alto")

    # Score DataCrédito
    min_dc = criterios.get("score_datacredito_minimo", 550)
    if dc < min_dc:
        rechazos.append(f"Score DataCrédito {dc} por debajo del mínimo ({min_dc})")
        score -= 40
    elif dc < min_dc + 50:
        score -= 15
        condiciones.append("Score DataCrédito bajo, se recomienda aval o codeudor")

    # Score CIFIN
    min_cf = criterios.get("score_cifin_minimo", 500)
    if cf < min_cf:
        rechazos.append(f"Score CIFIN {cf} por debajo del mínimo ({min_cf})")
        score -= 30
    elif cf < min_cf + 50:
        score -= 10

    # Endeudamiento
    max_endeud = criterios.get("endeudamiento_maximo_pct", 60)
    if endeud > max_endeud:
        rechazos.append(f"Endeudamiento {endeud:.1f}% supera el máximo permitido ({max_endeud}%)")
        score -= 25
    elif endeud > max_endeud * 0.8:
        score -= 10
        condiciones.append("Nivel de endeudamiento elevado")

    # Obligaciones CIFIN
    max_oblig = criterios.get("obligaciones_cifin_maximas", 5)
    if oblig > max_oblig:
        rechazos.append(f"Número de obligaciones CIFIN ({oblig}) supera el máximo ({max_oblig})")
        score -= 15

    # Confiabilidad
    if criterios.get("requiere_confiable", True) and not confiable:
        rechazos.append("Cliente no cumple criterio de confiabilidad según informe")
        score -= 20

    # Nivel de riesgo
    permitidos = criterios.get("niveles_riesgo_permitidos", ["bajo", "medio"])
    if riesgo not in permitidos:
        rechazos.append(f"Nivel de riesgo '{riesgo}' no está dentro de los permitidos {permitidos}")
        score -= 35

    return max(0, score), rechazos, condiciones


def calcular_condiciones_prestamo(cliente: dict, criterios: dict, monto_solicitado: float, score: int) -> dict:
    """
    Calcula monto aprobado, tasa y plazo según el perfil del cliente.
    """
    riesgo = cliente.get("nivel_riesgo", "alto")
    dc = cliente.get("score_datacredito") or 0
    endeud = float(cliente.get("endeudamiento_datacredito") or 0)

    # Monto: ajustar según score y endeudamiento
    monto_max = criterios.get("monto_maximo_base", 50_000_000)
    factor_score = min(1.0, score / 100)
    factor_endeud = max(0.3, 1 - (endeud / 100))

    # Bonus por buen score DC
    if dc >= 750:
        factor_score = min(1.0, factor_score * 1.2)
    elif dc >= 650:
        factor_score = min(1.0, factor_score * 1.1)

    monto_calculado = monto_max * factor_score * factor_endeud
    monto_aprobado = min(monto_solicitado, monto_calculado)
    monto_aprobado = max(criterios.get("monto_minimo", 500_000), monto_aprobado)
    monto_aprobado = round(monto_aprobado / 100_000) * 100_000  # Redondear a 100k

    # Tasa: base + ajuste por riesgo
    tasa = criterios.get("tasa_base_anual_pct", 24.0)
    if riesgo == "medio":
        tasa += criterios.get("ajuste_tasa_riesgo_medio_pct", 4.0)
    if dc < 600:
        tasa += 2.0
    elif dc >= 750:
        tasa -= 2.0
    tasa = round(max(12.0, min(36.0, tasa)), 2)

    # Plazo: máximo según riesgo
    plazo_max = criterios.get("plazo_maximo_meses", 60)
    if riesgo == "medio":
        plazo_max = min(plazo_max, 36)
    if endeud > 40:
        plazo_max = min(plazo_max, 24)

    return {
        "monto_aprobado": monto_aprobado,
        "tasa_interes_anual": tasa,
        "plazo_maximo_meses": plazo_max,
        "plazo_minimo_meses": criterios.get("plazo_minimo_meses", 3),
    }


def generar_justificacion_ia(cliente: dict, decision: str, condiciones_prestamo: dict,
                               rechazos: list, score: int) -> str:
    """Genera una justificación en lenguaje natural con Claude."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    resumen_cliente = {
        "nombre": cliente.get("nombre"),
        "score_datacredito": cliente.get("score_datacredito"),
        "score_cifin": cliente.get("score_cifin"),
        "endeudamiento_pct": cliente.get("endeudamiento_datacredito"),
        "obligaciones_cifin": cliente.get("obligaciones_cifin"),
        "es_confiable": cliente.get("es_confiable"),
        "nivel_riesgo": cliente.get("nivel_riesgo"),
    }

    prompt = f"""Eres un oficial de crédito de una entidad financiera colombiana.
Redacta una justificación profesional y clara (máximo 3 oraciones) para la siguiente decisión crediticia.

CLIENTE: {json.dumps(resumen_cliente, ensure_ascii=False)}
DECISIÓN: {decision.upper()}
SCORE INTERNO: {score}/100
{"MOTIVOS DE RECHAZO: " + "; ".join(rechazos) if rechazos else ""}
{"CONDICIONES: " + str(condiciones_prestamo) if decision == "aprobado" else ""}

Escribe solo la justificación, sin saludos ni títulos."""

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


def tomar_decision(cliente_id: int, monto_solicitado: float,
                   politica_id: Optional[int] = None) -> dict:
    """
    Función principal: toma una decisión crediticia completa para un cliente.
    """
    # Cargar cliente
    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM clientes_credito WHERE id = %s", (cliente_id,))
            cliente = dict(cur.fetchone())

    # Cargar política
    if politica_id:
        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM politica_credito WHERE id = %s", (politica_id,))
                pol = dict(cur.fetchone())
    else:
        pol = get_politica_activa()

    criterios = pol["criterios"] if pol else DEFAULT_CRITERIOS
    pid = pol["id"] if pol else None

    # Calcular score y motivos
    score, rechazos, condiciones = calcular_score_decision(cliente, criterios)

    # Determinar decisión
    if rechazos:
        if score >= 40:
            decision = "revision_manual"
        else:
            decision = "rechazado"
    else:
        decision = "aprobado"

    # Condiciones del préstamo (solo si aprobado o revisión)
    condiciones_prestamo = {}
    if decision in ("aprobado", "revision_manual") and not rechazos:
        condiciones_prestamo = calcular_condiciones_prestamo(cliente, criterios, monto_solicitado, score)

    # Justificación IA
    justificacion = generar_justificacion_ia(cliente, decision, condiciones_prestamo, rechazos, score)

    # Guardar en BD
    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO decisiones_credito
                    (cliente_id, politica_id, decision, monto_solicitado, monto_aprobado,
                     tasa_interes, plazo_meses, score_decision, motivos_rechazo,
                     condiciones, justificacion_ia)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (
                cliente_id, pid, decision,
                monto_solicitado,
                condiciones_prestamo.get("monto_aprobado"),
                condiciones_prestamo.get("tasa_interes_anual"),
                condiciones_prestamo.get("plazo_maximo_meses"),
                score, rechazos, condiciones, justificacion
            ))
            decision_id = cur.fetchone()[0]
        conn.commit()

    return {
        "decision_id": decision_id,
        "cliente": cliente.get("nombre"),
        "cedula": cliente.get("cedula"),
        "decision": decision,
        "score_interno": score,
        "monto_solicitado": monto_solicitado,
        **condiciones_prestamo,
        "motivos_rechazo": rechazos,
        "condiciones": condiciones,
        "justificacion": justificacion,
    }


# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    init_decision_db()

    if len(sys.argv) == 3:
        cid = int(sys.argv[1])
        monto = float(sys.argv[2])
        result = tomar_decision(cid, monto)
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        print("Uso: python decision_engine.py <cliente_id> <monto_solicitado>")
        print("Ejemplo: python decision_engine.py 1 5000000")
