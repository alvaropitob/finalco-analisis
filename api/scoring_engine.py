"""
Motor de Scoring Multi-fuente — Puntaje 0-100 por 4 ejes ponderados.

Replica la lógica del Excel Finalco Motor VF7:
  Eje 1: CAPACIDAD      (peso default 30)
  Eje 2: COMPORTAMIENTO (peso default 30)
  Eje 3: FLUJO          (peso default 20)
  Eje 4: ENTORNO        (peso default  8)

Ajustes adicionales: Begini, ADRES, Patrimonio, Experiencia Preselecta.

Bandas de decisión:
  A (80-100): Aprobar $400K-600K
  B (65-79):  Aprobar $300K-400K
  C (50-64):  Aprobar entrada $200K
  C- (40-49): Revisión Comité
  D (0-39):   Rechazar
"""
import logging
from typing import Optional

log = logging.getLogger(__name__)

# ── Pesos por defecto (editables en el parametrizador) ────────────────────

DEFAULT_PESOS = {
    "capacidad": 30,
    "comportamiento": 30,
    "flujo": 20,
    "entorno": 8,
}

DEFAULT_BANDAS = {
    "A": 80,   # >= 80
    "B": 65,   # >= 65
    "C": 50,   # >= 50
    "C-": 40,  # >= 40
    "D": 0,    # < 40
}


# ── Eje 1: CAPACIDAD (max 36 pts) ────────────────────────────────────────

def _score_uso_cupo(pct_deuda: float) -> int:
    """CAP1: % del cupo usado (Saldo/Cupo total)."""
    if pct_deuda is None:
        return 5
    if pct_deuda < 50:
        return 10
    if pct_deuda < 80:
        return 8
    if pct_deuda < 90:
        return 5
    return 2

def _score_holgura(cuota_nueva: float, cuota_total_actual: float) -> int:
    """CAP2: cuota nueva vs lo que ya paga."""
    if cuota_total_actual is None or cuota_total_actual <= 0:
        return 5
    ratio = (cuota_nueva or 0) / cuota_total_actual
    if ratio <= 0.20:
        return 10
    if ratio <= 0.35:
        return 7
    if ratio <= 0.50:
        return 4
    return 0

def _score_mora_hoy(saldo_en_mora: float) -> int:
    """CAP3: saldo en mora actual."""
    if saldo_en_mora is None or saldo_en_mora == 0:
        return 6
    if saldo_en_mora <= 100_000:
        return 3
    if saldo_en_mora <= 500_000:
        return 1
    return 0

def _score_carga(creditos_vigentes: int) -> int:
    """CAP4: número de créditos vigentes."""
    if creditos_vigentes is None:
        return 3
    if creditos_vigentes <= 5:
        return 5
    if creditos_vigentes <= 8:
        return 4
    if creditos_vigentes <= 12:
        return 2
    return 1

def _score_tdc(pct_uso_tdc: float) -> int:
    """CAP5: uso del cupo de tarjetas de crédito."""
    if pct_uso_tdc is None:
        return 3  # Sin tarjetas
    if pct_uso_tdc < 50:
        return 5
    if pct_uso_tdc < 80:
        return 3
    return 1

def calcular_eje_capacidad(datos: dict) -> tuple:
    """Calcula subtotal del eje Capacidad."""
    pts = {
        "uso_cupo": _score_uso_cupo(datos.get("pct_deuda_total")),
        "holgura": _score_holgura(datos.get("cuota_finalco"), datos.get("valor_cuota_reporte")),
        "mora_hoy": _score_mora_hoy(datos.get("saldo_mora_total")),
        "carga": _score_carga(datos.get("creditos_vigentes")),
        "tdc": _score_tdc(datos.get("pct_uso_tdc")),
    }
    max_pts = {"uso_cupo": 10, "holgura": 10, "mora_hoy": 6, "carga": 5, "tdc": 5}
    total = sum(pts.values())
    maximo = sum(max_pts.values())
    return total, maximo, pts


# ── Eje 2: COMPORTAMIENTO (max 55 pts) ───────────────────────────────────

def _score_vector_6m(peor_mora_6m: str) -> int:
    """COMP1: peor mora en vectores últimos 6 meses."""
    if not peor_mora_6m or peor_mora_6m == "N":
        return 15
    if peor_mora_6m == "1":
        return 10
    if peor_mora_6m == "2":
        return 6
    if peor_mora_6m in ("3", "4"):
        return 2
    return 0  # D, C

def _score_estado_obligaciones(estado: str) -> int:
    """COMP2: estado actual de obligaciones vigentes."""
    if not estado:
        return 5
    estado = estado.lower()
    if "todas al dia" in estado or "al dia" in estado:
        return 10
    if "una en mora 30" in estado:
        return 7
    if "mora 60" in estado or "dos o mas" in estado:
        return 4
    return 0  # castigada / dudoso

def _score_cierres(patron: str) -> int:
    """COMP3: patrón de cierres de créditos pasados."""
    if not patron:
        return 3
    patron = patron.lower()
    if "80" in patron or "100" in patron or "pago vol" in patron:
        return 8
    if "60" in patron or "79" in patron:
        return 5
    if "40" in patron or "59" in patron:
        return 3
    return 1

def _score_experiencia(anios_historial: int) -> int:
    """COMP7: profundidad del historial crediticio."""
    if anios_historial is None:
        return 1
    if anios_historial > 5:
        return 6
    if anios_historial >= 2:
        return 4
    if anios_historial >= 1:
        return 2
    return 1

def calcular_eje_comportamiento(datos: dict) -> tuple:
    """Calcula subtotal del eje Comportamiento."""
    pts = {
        "vector_6m": _score_vector_6m(datos.get("peor_mora_6m")),
        "estado_oblig": _score_estado_obligaciones(datos.get("estado_obligaciones")),
        "cierres": _score_cierres(datos.get("patron_cierres")),
        "experiencia": _score_experiencia(datos.get("anios_historial")),
    }
    max_pts = {"vector_6m": 15, "estado_oblig": 10, "cierres": 8, "experiencia": 6}
    total = sum(pts.values())
    maximo = sum(max_pts.values())
    return total, maximo, pts


# ── Eje 3: FLUJO (max 20 pts) ────────────────────────────────────────────

def _score_disponible(disponible_tras_cuota: float) -> int:
    """FLUJO1: dinero disponible después de pagar cuota Finalco."""
    if disponible_tras_cuota is None:
        return 2
    if disponible_tras_cuota > 0:
        return 8
    if disponible_tras_cuota >= -50_000:
        return 4
    if disponible_tras_cuota >= -200_000:
        return 2
    return 0

def _score_peso_cuota(cuota_finalco: float, ingresos_netos: float) -> int:
    """FLUJO2: cuota Finalco / ingreso neto."""
    if not ingresos_netos or ingresos_netos <= 0:
        return 0
    ratio = (cuota_finalco or 0) / ingresos_netos
    if ratio < 0.20:
        return 6
    if ratio < 0.30:
        return 4
    if ratio < 0.40:
        return 2
    return 0

def _score_carga_total(total_cuotas: float, cuota_nueva: float, ingresos_netos: float) -> int:
    """FLUJO3: (deuda servida + cuota nueva) / ingreso neto."""
    if not ingresos_netos or ingresos_netos <= 0:
        return 0
    ratio = ((total_cuotas or 0) + (cuota_nueva or 0)) / ingresos_netos
    if ratio < 0.50:
        return 3
    if ratio < 0.80:
        return 2
    if ratio <= 1.0:
        return 1
    return 0

def _score_coherencia_ingreso(declarado: float, quanto: float) -> int:
    """FLUJO4: coherencia entre ingreso declarado y QUANTO."""
    if not declarado or not quanto or quanto <= 0:
        return 1
    if declarado <= quanto:
        return 3  # Coherente
    if declarado <= quanto * 1.5:
        return 2  # Ligeramente arriba
    return 0  # Muy por encima

def calcular_eje_flujo(datos: dict) -> tuple:
    """Calcula subtotal del eje Flujo."""
    pts = {
        "disponible": _score_disponible(datos.get("disponible_tras_cuota")),
        "peso_cuota": _score_peso_cuota(datos.get("cuota_finalco"), datos.get("ingresos_netos")),
        "carga_total": _score_carga_total(
            datos.get("valor_cuota_reporte"), datos.get("cuota_finalco"), datos.get("ingresos_netos")
        ),
        "coherencia": _score_coherencia_ingreso(datos.get("ingreso_declarado"), datos.get("quanto_ingreso")),
    }
    max_pts = {"disponible": 8, "peso_cuota": 6, "carga_total": 3, "coherencia": 3}
    total = sum(pts.values())
    maximo = sum(max_pts.values())
    return total, maximo, pts


# ── Eje 4: ENTORNO (max 22 pts) ──────────────────────────────────────────

def _score_identidad(tipo_consulta: int, correos_nuevos: int) -> int:
    """ENT1: validez de la consulta."""
    if tipo_consulta and tipo_consulta in (5, 6, 7):
        return 0
    if correos_nuevos and correos_nuevos > 2:
        return 1
    return 3

def _score_arraigo(departamentos_distintos: int) -> int:
    """ENT2: estabilidad geográfica."""
    if departamentos_distintos is None:
        return 3
    if departamentos_distintos <= 1:
        return 5
    if departamentos_distintos <= 2:
        return 3
    return 1

def _score_bancarizacion(cuentas_activas_1a: int) -> int:
    """ENT3: cuentas activas con más de 1 año."""
    if cuentas_activas_1a is None:
        return 2
    if cuentas_activas_1a >= 3:
        return 5
    if cuentas_activas_1a >= 1:
        return 3
    return 0

def _score_formalidad(tiene_rut: bool, anios_contacto: float) -> int:
    """ENT4: RUT o contacto/empleador estable."""
    pts = 0
    if tiene_rut:
        pts += 2
    if anios_contacto and anios_contacto >= 3:
        pts += 2
    elif anios_contacto and anios_contacto >= 1:
        pts += 1
    return min(pts, 4)

def _score_apetito_credito(consultas_30d: int) -> int:
    """ENT5: entidades que consultaron en 30 días."""
    if consultas_30d is None:
        return 3
    if consultas_30d <= 2:
        return 5
    if consultas_30d <= 5:
        return 3
    if consultas_30d <= 10:
        return 1
    return 0

def calcular_eje_entorno(datos: dict) -> tuple:
    """Calcula subtotal del eje Entorno."""
    pts = {
        "identidad": _score_identidad(datos.get("tipo_consulta"), datos.get("correos_nuevos_12m")),
        "arraigo": _score_arraigo(datos.get("departamentos_distintos")),
        "bancarizacion": _score_bancarizacion(datos.get("cuentas_activas_1a")),
        "formalidad": _score_formalidad(datos.get("tiene_rut"), datos.get("anios_contacto")),
        "apetito": _score_apetito_credito(datos.get("consultas_30d")),
    }
    max_pts = {"identidad": 3, "arraigo": 5, "bancarizacion": 5, "formalidad": 4, "apetito": 5}
    total = sum(pts.values())
    maximo = sum(max_pts.values())
    return total, maximo, pts


# ── AJUSTES ──────────────────────────────────────────────────────────────

def calcular_ajustes(datos: dict) -> dict:
    """Calcula ajustes que se suman/restan al puntaje base (rango -5 a +5 cada uno)."""
    from extractor_begini import ajuste_puntaje_begini
    
    ajustes = {}
    
    # Begini
    ajustes["begini"] = ajuste_puntaje_begini(datos.get("score_begini"))
    
    # ADRES: estado de salud
    estado_adres = (datos.get("estado_adres") or "").upper()
    if estado_adres == "ACTIVO":
        ajustes["adres"] = 2
    elif estado_adres in ("INACTIVO", "RETIRADO", "SUSPENDIDO"):
        ajustes["adres"] = -3
    else:
        ajustes["adres"] = 0
    
    # Patrimonio (solo suma, nunca resta)
    tiene_vehiculo = datos.get("tiene_vehiculo", False)
    tiene_propiedad = datos.get("tiene_propiedad", False)
    if tiene_vehiculo and tiene_propiedad:
        ajustes["patrimonio"] = 5
    elif tiene_vehiculo or tiene_propiedad:
        ajustes["patrimonio"] = 3
    else:
        ajustes["patrimonio"] = 0
    
    # Experiencia Preselecta
    decision_pres = (datos.get("decision_preselecta") or "").lower()
    if decision_pres == "aprobado":
        ajustes["experiencia"] = 3
    elif decision_pres == "estudio":
        ajustes["experiencia"] = 0
    elif decision_pres == "rechazado":
        ajustes["experiencia"] = -3
    else:
        ajustes["experiencia"] = 0
    
    return ajustes


# ── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────

def calcular_scoring_multifuente(
    datos: dict,
    pesos: Optional[dict] = None,
    bandas: Optional[dict] = None,
) -> dict:
    """
    Calcula el scoring multi-fuente completo.
    
    Args:
        datos: dict con todos los datos consolidados del cliente
        pesos: dict con pesos de cada eje (default: DEFAULT_PESOS)
        bandas: dict con cortes de banda (default: DEFAULT_BANDAS)
    
    Returns:
        dict con puntaje total, desglose por eje, ajustes, banda y decisión
    """
    pesos = pesos or DEFAULT_PESOS
    bandas = bandas or DEFAULT_BANDAS
    
    # Calcular cada eje
    cap_pts, cap_max, cap_desglose = calcular_eje_capacidad(datos)
    comp_pts, comp_max, comp_desglose = calcular_eje_comportamiento(datos)
    flujo_pts, flujo_max, flujo_desglose = calcular_eje_flujo(datos)
    ent_pts, ent_max, ent_desglose = calcular_eje_entorno(datos)
    
    # Puntaje base ponderado (normalizado a 100)
    # Fórmula: Σ(subtotal_eje / max_eje × peso_eje) / Σ(pesos) × 100
    suma_ponderada = 0
    suma_pesos = 0
    
    ejes = {
        "capacidad": (cap_pts, cap_max, pesos.get("capacidad", 0)),
        "comportamiento": (comp_pts, comp_max, pesos.get("comportamiento", 0)),
        "flujo": (flujo_pts, flujo_max, pesos.get("flujo", 0)),
        "entorno": (ent_pts, ent_max, pesos.get("entorno", 0)),
    }
    
    for nombre, (pts, maximo, peso) in ejes.items():
        if peso > 0 and maximo > 0:
            pct_eje = pts / maximo
            suma_ponderada += pct_eje * peso
            suma_pesos += peso
    
    puntaje_base = (suma_ponderada / suma_pesos * 100) if suma_pesos > 0 else 0
    
    # Ajustes
    ajustes = calcular_ajustes(datos)
    total_ajustes = sum(ajustes.values())
    
    # Puntaje final (acotado 0-100)
    puntaje_final = max(0, min(100, puntaje_base + total_ajustes))
    
    # Determinar banda
    if puntaje_final >= bandas.get("A", 80):
        banda = "A"
        decision = "aprobado"
        monto_rango = "$400K - $600K"
    elif puntaje_final >= bandas.get("B", 65):
        banda = "B"
        decision = "aprobado"
        monto_rango = "$300K - $400K"
    elif puntaje_final >= bandas.get("C", 50):
        banda = "C"
        decision = "aprobado"
        monto_rango = "$200K"
    elif puntaje_final >= bandas.get("C-", 40):
        banda = "C-"
        decision = "revision_manual"
        monto_rango = "Revisión Comité"
    else:
        banda = "D"
        decision = "rechazado"
        monto_rango = "$0"
    
    resultado = {
        "puntaje_base": round(puntaje_base, 2),
        "puntaje_final": round(puntaje_final, 2),
        "banda": banda,
        "decision": decision,
        "monto_rango_sugerido": monto_rango,
        
        "ejes": {
            "capacidad": {
                "puntos": cap_pts,
                "maximo": cap_max,
                "porcentaje": round(cap_pts / cap_max * 100, 1) if cap_max > 0 else 0,
                "peso": pesos.get("capacidad", 0),
                "desglose": cap_desglose,
            },
            "comportamiento": {
                "puntos": comp_pts,
                "maximo": comp_max,
                "porcentaje": round(comp_pts / comp_max * 100, 1) if comp_max > 0 else 0,
                "peso": pesos.get("comportamiento", 0),
                "desglose": comp_desglose,
            },
            "flujo": {
                "puntos": flujo_pts,
                "maximo": flujo_max,
                "porcentaje": round(flujo_pts / flujo_max * 100, 1) if flujo_max > 0 else 0,
                "peso": pesos.get("flujo", 0),
                "desglose": flujo_desglose,
            },
            "entorno": {
                "puntos": ent_pts,
                "maximo": ent_max,
                "porcentaje": round(ent_pts / ent_max * 100, 1) if ent_max > 0 else 0,
                "peso": pesos.get("entorno", 0),
                "desglose": ent_desglose,
            },
        },
        
        "ajustes": ajustes,
        "total_ajustes": total_ajustes,
        "pesos_usados": pesos,
        "bandas_usadas": bandas,
    }
    
    log.info(
        f"Scoring: Base={puntaje_base:.1f} + Ajustes={total_ajustes} = "
        f"Final={puntaje_final:.1f} -> Banda {banda} ({decision})"
    )
    
    return resultado
