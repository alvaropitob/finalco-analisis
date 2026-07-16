"""
Motor de cálculo de amortización — Sistema Francés (cuota fija)
Sprint 2: Módulo D del Motor de Decisión y Simulador de Créditos

Precision: Usa Decimal para evitar errores de redondeo del Excel.
"""

from decimal import Decimal, ROUND_HALF_UP, getcontext
from datetime import date, timedelta
from typing import Optional
import json
import logging

log = logging.getLogger(__name__)

# Precisión interna alta para cálculos intermedios
getcontext().prec = 28

# ── Constantes ────────────────────────────────────────────────────────────────

TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")
EIGHT_PLACES = Decimal("0.00000001")


# ── Conversión de tasas ───────────────────────────────────────────────────────

def tasa_ea_a_mensual(tasa_ea: Decimal) -> Decimal:
    """
    Convierte Tasa Efectiva Anual (EA) a tasa mensual equivalente.
    Fórmula: i_mensual = (1 + EA)^(1/12) - 1
    """
    uno = Decimal("1")
    doce = Decimal("12")
    return (uno + tasa_ea) ** (uno / doce) - uno


def tasa_ea_a_nominal(tasa_ea: Decimal) -> Decimal:
    """
    Convierte Tasa EA a Tasa Nominal Anual (capitalización mensual).
    Fórmula: Nominal = i_mensual * 12
    """
    i_mensual = tasa_ea_a_mensual(tasa_ea)
    return i_mensual * Decimal("12")


# ── Cuota fija (Sistema Francés) ──────────────────────────────────────────────

def calcular_cuota_fija(monto: Decimal, tasa_mensual: Decimal, plazo_meses: int) -> Decimal:
    """
    Calcula la cuota fija mensual con el Sistema Francés.
    Fórmula: C = M * [r(1+r)^n] / [(1+r)^n - 1]
    
    Donde:
      M = monto del préstamo
      r = tasa de interés mensual
      n = número de cuotas (plazo en meses)
    """
    uno = Decimal("1")
    n = Decimal(str(plazo_meses))
    
    if tasa_mensual == Decimal("0"):
        return (monto / n).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    
    factor = (uno + tasa_mensual) ** n
    cuota = monto * (tasa_mensual * factor) / (factor - uno)
    return cuota.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


# ── Tabla de amortización completa ────────────────────────────────────────────

def generar_tabla_amortizacion(
    monto: float,
    plazo_meses: int,
    tasa_ea: float,
    seguro_vida_pct: float = 0.0,
    fianza_pct: float = 0.0,
    gastos_tecnologia: float = 0.0,
    iva_pct: float = 0.19,
    fecha_inicio: Optional[str] = None,
    seguro_sobre_saldo: bool = True,
) -> dict:
    """
    Genera la tabla de amortización completa con desglose por cuota.
    
    Args:
        monto: Monto del préstamo en pesos colombianos
        plazo_meses: Número de cuotas mensuales
        tasa_ea: Tasa Efectiva Anual como decimal (ej: 0.24 para 24%)
        seguro_vida_pct: Porcentaje mensual del seguro de vida (ej: 0.001 para 0.1%)
        fianza_pct: Porcentaje de fianza sobre el monto (ej: 0.005 para 0.5%)
        gastos_tecnologia: Valor fijo mensual de gastos de tecnología
        iva_pct: IVA como decimal (ej: 0.19 para 19%)
        fecha_inicio: Fecha de inicio del crédito (YYYY-MM-DD), default: hoy
        seguro_sobre_saldo: Si True, el seguro se calcula sobre el saldo; si False, sobre el monto original
    
    Returns:
        dict con resumen del crédito y tabla de pagos detallada
    """
    # Convertir a Decimal para precisión
    M = Decimal(str(monto))
    tasa_ea_d = Decimal(str(tasa_ea))
    seguro_d = Decimal(str(seguro_vida_pct))
    fianza_d = Decimal(str(fianza_pct))
    tech_d = Decimal(str(gastos_tecnologia))
    iva_d = Decimal(str(iva_pct))
    
    # Calcular tasa mensual
    tasa_mensual = tasa_ea_a_mensual(tasa_ea_d)
    tasa_nominal = tasa_ea_a_nominal(tasa_ea_d)
    
    # Calcular cuota fija (capital + interés solamente)
    cuota_fija = calcular_cuota_fija(M, tasa_mensual, plazo_meses)
    
    # Fecha de inicio
    if fecha_inicio:
        fecha_base = date.fromisoformat(fecha_inicio)
    else:
        fecha_base = date.today()
    
    # ── Generar tabla ─────────────────────────────────────────────────────────
    tabla = []
    saldo = M
    total_capital = Decimal("0")
    total_interes = Decimal("0")
    total_seguro = Decimal("0")
    total_fianza = Decimal("0")
    total_tech = Decimal("0")
    total_iva = Decimal("0")
    total_pagado = Decimal("0")
    
    for i in range(1, plazo_meses + 1):
        # Fecha de pago: sumar meses desde la fecha base
        fecha_pago = _sumar_meses(fecha_base, i)
        
        # Interés del período
        interes = (saldo * tasa_mensual).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        
        # Capital amortizado
        capital = cuota_fija - interes
        
        # Ajuste en la última cuota para cerrar el saldo exacto
        if i == plazo_meses:
            capital = saldo
            cuota_ajustada = capital + interes
        else:
            cuota_ajustada = cuota_fija
        
        # Seguro de vida
        if seguro_sobre_saldo:
            seguro = (saldo * seguro_d).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        else:
            seguro = (M * seguro_d).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        
        # Fianza
        fianza = (M * fianza_d / Decimal(str(plazo_meses))).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        
        # Gastos de tecnología
        tech = tech_d.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        
        # IVA (sobre intereses + gastos tecnología, según normativa colombiana)
        base_iva = interes + tech
        iva = (base_iva * iva_d).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        
        # Cuota total del período
        cuota_total = cuota_ajustada + seguro + fianza + tech + iva
        
        # Nuevo saldo
        nuevo_saldo = (saldo - capital).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        
        fila = {
            "numero": i,
            "fecha_pago": fecha_pago.isoformat(),
            "saldo_inicial": float(saldo),
            "capital": float(capital.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)),
            "interes": float(interes),
            "seguro_vida": float(seguro),
            "fianza": float(fianza),
            "gastos_tecnologia": float(tech),
            "iva": float(iva),
            "cuota_base": float(cuota_ajustada.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)),
            "cuota_total": float(cuota_total.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)),
            "saldo_final": float(max(Decimal("0"), nuevo_saldo)),
        }
        tabla.append(fila)
        
        # Acumulados
        total_capital += capital
        total_interes += interes
        total_seguro += seguro
        total_fianza += fianza
        total_tech += tech
        total_iva += iva
        total_pagado += cuota_total
        
        # Actualizar saldo
        saldo = max(Decimal("0"), nuevo_saldo)
    
    # ── Resumen ───────────────────────────────────────────────────────────────
    resumen = {
        "monto_credito": float(M),
        "plazo_meses": plazo_meses,
        "tasa_ea_pct": float((tasa_ea_d * Decimal("100")).quantize(FOUR_PLACES)),
        "tasa_nominal_pct": float((tasa_nominal * Decimal("100")).quantize(FOUR_PLACES)),
        "tasa_mensual_pct": float((tasa_mensual * Decimal("100")).quantize(FOUR_PLACES)),
        "cuota_fija_base": float(cuota_fija),
        "cuota_estimada_total": float(tabla[0]["cuota_total"]) if tabla else 0,
        "total_capital": float(total_capital.quantize(TWO_PLACES)),
        "total_intereses": float(total_interes.quantize(TWO_PLACES)),
        "total_seguro_vida": float(total_seguro.quantize(TWO_PLACES)),
        "total_fianza": float(total_fianza.quantize(TWO_PLACES)),
        "total_gastos_tecnologia": float(total_tech.quantize(TWO_PLACES)),
        "total_iva": float(total_iva.quantize(TWO_PLACES)),
        "gran_total": float(total_pagado.quantize(TWO_PLACES)),
        "costo_financiero_total": float((total_pagado - M).quantize(TWO_PLACES)),
        "fecha_inicio": fecha_base.isoformat(),
        "fecha_fin": tabla[-1]["fecha_pago"] if tabla else None,
    }
    
    return {
        "resumen": resumen,
        "tabla": tabla,
    }


def _sumar_meses(fecha: date, meses: int) -> date:
    """Suma N meses a una fecha, manejando fin de mes."""
    mes = fecha.month + meses
    anio = fecha.year + (mes - 1) // 12
    mes = (mes - 1) % 12 + 1
    
    # Ajustar día si el mes destino tiene menos días
    import calendar
    max_dia = calendar.monthrange(anio, mes)[1]
    dia = min(fecha.day, max_dia)
    
    return date(anio, mes, dia)


# ── Utilidades ────────────────────────────────────────────────────────────────

def resumen_rapido(monto: float, plazo_meses: int, tasa_ea: float) -> dict:
    """
    Cálculo rápido de cuota estimada sin tabla completa.
    Útil para previews en el frontend.
    """
    M = Decimal(str(monto))
    tasa_mensual = tasa_ea_a_mensual(Decimal(str(tasa_ea)))
    cuota = calcular_cuota_fija(M, tasa_mensual, plazo_meses)
    
    total_interes = cuota * Decimal(str(plazo_meses)) - M
    
    return {
        "cuota_base_mensual": float(cuota),
        "total_intereses": float(total_interes.quantize(TWO_PLACES)),
        "gran_total": float((cuota * Decimal(str(plazo_meses))).quantize(TWO_PLACES)),
    }


# ── CLI para pruebas ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 4:
        print("Uso: python amortizacion.py <monto> <plazo_meses> <tasa_ea_pct>")
        print("Ejemplo: python amortizacion.py 5000000 12 24")
        sys.exit(1)
    
    monto = float(sys.argv[1])
    plazo = int(sys.argv[2])
    tasa = float(sys.argv[3]) / 100  # Convertir de porcentaje a decimal
    
    result = generar_tabla_amortizacion(
        monto=monto,
        plazo_meses=plazo,
        tasa_ea=tasa,
        seguro_vida_pct=0.001,   # 0.1% mensual
        fianza_pct=0.005,        # 0.5% del monto
        gastos_tecnologia=5000,  # $5,000 COP fijo
        iva_pct=0.19,
    )
    
    print("=" * 80)
    print(f"  TABLA DE AMORTIZACION - Sistema Frances (Cuota Fija)")
    print("=" * 80)
    print(f"  Monto:       ${monto:,.0f}")
    print(f"  Plazo:       {plazo} meses")
    print(f"  Tasa EA:     {result['resumen']['tasa_ea_pct']:.2f}%")
    print(f"  Tasa mensual:{result['resumen']['tasa_mensual_pct']:.4f}%")
    print(f"  Cuota base:  ${result['resumen']['cuota_fija_base']:,.0f}")
    print("=" * 80)
    print(f"  {'#':>3} | {'Fecha':^12} | {'Saldo Ini':>14} | {'Capital':>12} | {'Interes':>10} | {'Seguro':>8} | {'Cuota Total':>12} | {'Saldo Fin':>14}")
    print("-" * 110)
    
    for r in result["tabla"]:
        print(f"  {r['numero']:>3} | {r['fecha_pago']:^12} | ${r['saldo_inicial']:>12,.0f} | ${r['capital']:>10,.0f} | ${r['interes']:>8,.0f} | ${r['seguro_vida']:>6,.0f} | ${r['cuota_total']:>10,.0f} | ${r['saldo_final']:>12,.0f}")
    
    print("=" * 110)
    res = result["resumen"]
    print(f"  Total Capital:   ${res['total_capital']:>14,.0f}")
    print(f"  Total Intereses: ${res['total_intereses']:>14,.0f}")
    print(f"  Total Seguro:    ${res['total_seguro_vida']:>14,.0f}")
    print(f"  Total Fianza:    ${res['total_fianza']:>14,.0f}")
    print(f"  Total Tecnologia:${res['total_gastos_tecnologia']:>14,.0f}")
    print(f"  Total IVA:       ${res['total_iva']:>14,.0f}")
    print(f"  GRAN TOTAL:      ${res['gran_total']:>14,.0f}")
    print(f"  Costo financiero:${res['costo_financiero_total']:>14,.0f}")
