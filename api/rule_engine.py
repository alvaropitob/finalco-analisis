"""
Rule Engine genérico — evalúa cualquier tipo de producto contra un esquema JSONB.
Las reglas de negocio viven en la tabla `reglas_negocio` y se aplican de forma
idéntica en web, Android e iOS (todos consumen el mismo endpoint).
"""
import json
import os
from typing import Optional
import anthropic
import psycopg2
from psycopg2.extras import RealDictCursor


# ── DB helper ─────────────────────────────────────────────────────────────────

def _get_conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "clientes_credito"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
    )


# ── Operadores soportados ─────────────────────────────────────────────────────

def _aplicar_operador(valor_cliente, operador: str, valor_regla) -> bool:
    if valor_cliente is None:
        return False
    if operador == ">=":
        return float(valor_cliente) >= float(valor_regla)
    if operador == "<=":
        return float(valor_cliente) <= float(valor_regla)
    if operador == "==":
        return valor_cliente == valor_regla
    if operador == "!=":
        return valor_cliente != valor_regla
    if operador == "in":
        return valor_cliente in valor_regla
    if operador == "not_in":
        return valor_cliente not in valor_regla
    return False


# ── Core: evaluar elegibilidad ────────────────────────────────────────────────

def evaluar_elegibilidad(datos_cliente: dict, esquema: dict) -> tuple[int, list, list]:
    """
    Evalúa los criterios de elegibilidad del esquema contra los datos del cliente.
    Retorna (score 0-100, motivos_rechazo, condiciones_especiales).
    """
    criterios = esquema.get("elegibilidad", [])
    rechazos = []
    condiciones = []
    score = 100

    peso_total = sum(c.get("peso", 0) for c in criterios) or 1

    for criterio in criterios:
        campo      = criterio["campo"]
        operador   = criterio["operador"]
        valor      = criterio["valor"]
        peso       = criterio.get("peso", 0)
        mensaje    = criterio.get("mensaje_rechazo", f"Criterio '{campo}' no cumplido")
        obligatorio = criterio.get("obligatorio", True)

        valor_cliente = datos_cliente.get(campo)
        cumple = _aplicar_operador(valor_cliente, operador, valor)

        if not cumple:
            deduccion = round((peso / peso_total) * 100)
            score -= deduccion
            if obligatorio:
                rechazos.append(mensaje)
            else:
                condiciones.append(f"Condición preferencial: {mensaje}")

    score = max(0, min(100, score))
    return score, rechazos, condiciones


# ── Calcular condiciones del préstamo ─────────────────────────────────────────

def calcular_condiciones_prestamo(datos_cliente: dict, esquema: dict, monto_solicitado: float, score: int) -> dict:
    """
    Calcula monto aprobado, tasa y plazo según las condiciones del esquema.
    Compatible con el esquema genérico (condiciones como dict libre).
    """
    cond = esquema.get("condiciones", {})

    monto_max = float(cond.get("monto_maximo_base", 50_000_000))
    monto_min = float(cond.get("monto_minimo", 500_000))
    tasa_base = float(cond.get("tasa_base_anual_pct", 24.0))
    ajuste_riesgo = float(cond.get("ajuste_tasa_riesgo_medio_pct", 4.0))
    plazo_max = int(cond.get("plazo_maximo_meses", 60))
    plazo_min = int(cond.get("plazo_minimo_meses", 3))
    factor_cp = float(cond.get("factor_capacidad_pago", 0.30))

    # Score bonus sobre monto máximo
    score_dc = datos_cliente.get("score_datacredito") or 0
    if score_dc >= 750:
        monto_max *= 1.2
    elif score_dc >= 650:
        monto_max *= 1.1

    # Factor de endeudamiento reduce el máximo
    endeudamiento = datos_cliente.get("endeudamiento_datacredito") or 0
    factor_deuda = max(0.3, 1 - (endeudamiento / 100))
    monto_max = round(monto_max * factor_deuda, -3)

    monto_aprobado = min(monto_solicitado, monto_max)
    monto_aprobado = max(monto_aprobado, monto_min) if monto_aprobado >= monto_min else 0

    # Tasa de interés
    tasa = tasa_base
    if datos_cliente.get("nivel_riesgo") == "medio":
        tasa += ajuste_riesgo
    if score < 50:
        tasa += 4.0
    elif score < 70:
        tasa += 2.0

    # Plazo según score
    plazo = plazo_max
    if score < 60:
        plazo = min(plazo_max, 36)

    return {
        "monto_aprobado": monto_aprobado,
        "tasa_interes_anual": round(tasa, 2),
        "plazo_maximo_meses": plazo,
        "plazo_minimo_meses": plazo_min,
        "factor_capacidad_pago": factor_cp,
    }


# ── Decisión final ────────────────────────────────────────────────────────────

def determinar_decision(score: int, rechazos: list, esquema: dict) -> str:
    cond = esquema.get("condiciones", {})
    score_min = int(cond.get("score_minimo_aprobacion", 60))
    score_revision = int(cond.get("score_revision_manual", 40))

    if rechazos:
        return "rechazado"
    if score >= score_min:
        return "aprobado"
    if score >= score_revision:
        return "revision_manual"
    return "rechazado"


# ── Justificación con Claude ──────────────────────────────────────────────────

def generar_justificacion_ia(cliente: dict, decision: str, condiciones_prestamo: dict,
                              rechazos: list, score: int, tipo_producto: str = "crédito") -> str:
    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        prompt = f"""Eres un analista de {tipo_producto} de Finalco. Genera una justificación profesional
en máximo 3 oraciones para la siguiente decisión crediticia:

Cliente: {cliente.get('nombre', 'N/A')} | Score interno: {score}/100
Decisión: {decision.upper()}
{f"Razones de rechazo: {', '.join(rechazos)}" if rechazos else ""}
{f"Monto aprobado: ${condiciones_prestamo.get('monto_aprobado', 0):,.0f} | Tasa: {condiciones_prestamo.get('tasa_interes_anual', 0)}% E.A." if decision == 'aprobado' else ""}

Sé claro, empático y profesional. No uses tecnicismos innecesarios."""

        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    except Exception as e:
        return f"Decisión tomada con base en la política de {tipo_producto} vigente. Score obtenido: {score}/100."


# ── Cargar regla activa desde DB ──────────────────────────────────────────────

def _cargar_regla(conn, regla_id: Optional[int], tipo_producto_codigo: str) -> dict:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if regla_id:
            cur.execute("""
                SELECT r.*, tp.codigo as tipo_codigo, tp.nombre as tipo_nombre
                FROM reglas_negocio r
                JOIN tipos_producto tp ON tp.id = r.tipo_producto_id
                WHERE r.id = %s
            """, (regla_id,))
        else:
            cur.execute("""
                SELECT r.*, tp.codigo as tipo_codigo, tp.nombre as tipo_nombre
                FROM reglas_negocio r
                JOIN tipos_producto tp ON tp.id = r.tipo_producto_id
                WHERE tp.codigo = %s AND r.activa = TRUE
                ORDER BY r.fecha_activacion DESC LIMIT 1
            """, (tipo_producto_codigo,))
        regla = cur.fetchone()
    if not regla:
        # Fallback: esquema por defecto para crédito
        return _regla_default_credito()
    return dict(regla)


def _regla_default_credito() -> dict:
    return {
        "id": None,
        "nombre": "Política por defecto",
        "tipo_codigo": "credito",
        "tipo_nombre": "Libre Inversión",
        "esquema": {
            "elegibilidad": [
                {"campo": "score_datacredito",      "operador": ">=",  "valor": 550,            "peso": 40, "mensaje_rechazo": "Score DataCrédito insuficiente (mínimo 550)", "obligatorio": True},
                {"campo": "score_cifin",            "operador": ">=",  "valor": 500,            "peso": 30, "mensaje_rechazo": "Score CIFIN insuficiente (mínimo 500)",       "obligatorio": True},
                {"campo": "endeudamiento_datacredito","operador": "<=","valor": 60.0,           "peso": 25, "mensaje_rechazo": "Endeudamiento supera el 60% permitido",       "obligatorio": True},
                {"campo": "nivel_riesgo",           "operador": "in",  "valor": ["bajo","medio"],"peso": 35,"mensaje_rechazo": "Nivel de riesgo alto no permitido",          "obligatorio": True},
                {"campo": "es_confiable",           "operador": "==",  "valor": True,           "peso": 20, "mensaje_rechazo": "Cliente no clasificado como confiable",       "obligatorio": False},
            ],
            "condiciones": {
                "monto_minimo": 500_000, "monto_maximo_base": 50_000_000,
                "tasa_base_anual_pct": 24.0, "ajuste_tasa_riesgo_medio_pct": 4.0,
                "plazo_minimo_meses": 3, "plazo_maximo_meses": 60,
                "factor_capacidad_pago": 0.30,
                "score_minimo_aprobacion": 60, "score_revision_manual": 40,
            }
        }
    }


# ── Función principal ─────────────────────────────────────────────────────────

def tomar_decision(cliente_id: int, monto_solicitado: float,
                   regla_id: Optional[int] = None,
                   tipo_producto_codigo: str = "credito",
                   usuario_id: Optional[int] = None) -> dict:
    """
    Orquesta la evaluación completa: carga cliente + regla → evalúa → guarda → retorna.
    Mismo resultado en web, Android e iOS.
    """
    conn = _get_conn()
    try:
        # Cargar cliente
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM clientes_credito WHERE id = %s", (cliente_id,))
            cliente = cur.fetchone()
        if not cliente:
            raise ValueError(f"Cliente {cliente_id} no encontrado")
        cliente = dict(cliente)

        # Cargar regla
        regla = _cargar_regla(conn, regla_id, tipo_producto_codigo)
        esquema = regla["esquema"]

        # Evaluar
        score, rechazos, condiciones_flag = evaluar_elegibilidad(cliente, esquema)
        decision = determinar_decision(score, rechazos, esquema)

        # Condiciones del préstamo
        condiciones_prestamo = {}
        if decision in ("aprobado", "revision_manual"):
            condiciones_prestamo = calcular_condiciones_prestamo(cliente, esquema, monto_solicitado, score)

        # Justificación IA
        tipo_nombre = regla.get("tipo_nombre", tipo_producto_codigo)
        justificacion = generar_justificacion_ia(cliente, decision, condiciones_prestamo,
                                                  rechazos, score, tipo_nombre)

        # Guardar decisión
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO decisiones_credito
                    (cliente_id, politica_id, decision, monto_solicitado,
                     monto_aprobado, tasa_interes, plazo_meses,
                     score_decision, motivos_rechazo, condiciones, justificacion_ia, revisado_por)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                cliente_id,
                regla.get("id"),
                decision,
                monto_solicitado,
                condiciones_prestamo.get("monto_aprobado"),
                condiciones_prestamo.get("tasa_interes_anual"),
                condiciones_prestamo.get("plazo_maximo_meses"),
                score,
                rechazos,
                condiciones_flag,
                justificacion,
                str(usuario_id) if usuario_id else "sistema",
            ))
            decision_id = cur.fetchone()["id"]
        conn.commit()

        return {
            "id": decision_id,
            "decision": decision,
            "score": score,
            "motivos_rechazo": rechazos,
            "condiciones": condiciones_flag,
            "monto_aprobado": condiciones_prestamo.get("monto_aprobado"),
            "tasa_interes_anual": condiciones_prestamo.get("tasa_interes_anual"),
            "plazo_maximo_meses": condiciones_prestamo.get("plazo_maximo_meses"),
            "justificacion_ia": justificacion,
            "regla_aplicada": regla.get("nombre", "Política por defecto"),
            "tipo_producto": tipo_nombre,
        }
    finally:
        conn.close()


# ── Sugerir política vía IA ───────────────────────────────────────────────────

def sugerir_politica_ia(stats: dict, tipo_producto: str = "credito") -> dict:
    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        prompt = f"""Eres experto en riesgo crediticio colombiano para Finalco.
Analiza estas estadísticas del portafolio de {tipo_producto} y sugiere criterios óptimos.

Estadísticas actuales:
{json.dumps(stats, ensure_ascii=False, indent=2)}

Responde ÚNICAMENTE con JSON válido con esta estructura:
{{
  "elegibilidad": [
    {{"campo": "score_datacredito", "operador": ">=", "valor": 550, "peso": 40,
      "mensaje_rechazo": "Score insuficiente", "obligatorio": true}}
  ],
  "condiciones": {{
    "monto_minimo": 500000,
    "monto_maximo_base": 50000000,
    "tasa_base_anual_pct": 24.0,
    "score_minimo_aprobacion": 60,
    "score_revision_manual": 40
  }},
  "justificacion": "Explicación de los cambios sugeridos",
  "advertencias": ["Lista de advertencias si aplica"]
}}"""

        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except Exception as e:
        return {"error": str(e), "justificacion": "No se pudo generar sugerencia"}
