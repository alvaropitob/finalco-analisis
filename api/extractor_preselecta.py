"""
Extractor de reportes Preselecta (DataCrédito Empresas — Consulta Preselecta)
Extrae: score Acierta Más, QUANTO, decisión, variables de mora, endeudamiento y más.
"""
import re
import logging
from typing import Optional

log = logging.getLogger(__name__)


def extraer_preselecta(texto: str, filename: str = "") -> dict:
    """
    Extrae datos de un reporte de Consulta Preselecta de DataCrédito.
    
    Args:
        texto: Texto extraído del PDF de Preselecta
        filename: Nombre del archivo para fallback de cédula
    
    Returns:
        dict con campos del análisis Preselecta
    """
    data = {
        "cedula": None,
        "nombres": None,
        "apellidos": None,
        "edad_rango": None,
        "genero": None,
        
        # Decisión y scoring
        "decision_preselecta": None,      # "Aprobado" / "Rechazado" / "Estudio"
        "score_acierta_mas": None,         # Score principal (1-999)
        "quanto_ingreso_medio": None,      # Ingreso estimado QUANTO
        "perfil_score": None,              # "Alto" / "Medio" / "Bajo" / "NA"
        
        # Variables de mora y riesgo (del bloque de respuesta personalizada)
        "embargos": 0,
        "cancelaciones_negativas_12m": 0,
        "cartera_recuperada": 0,
        "cartera_castigada": 0,
        "dudoso_recaudo": 0,
        "mora_30_vigente": 0,
        "mora_60_vigente": 0,
        "mora_90_vigente": 0,
        "mora_120_vigente": 0,
        "mora_30_hist_12m": 0,
        "mora_60_hist_12m": 0,
        "mora_90_hist_12m": 0,
        "mora_120_hist_12m": 0,
        
        # Capacidad de pago
        "ingresos_quanto": None,
        "gastos_financieros_no_rotativos": None,
        "gastos_financieros_rotativos": None,
        "gastos_personales": None,
        "disponible": None,
        "pct_endeudamiento": None,
        "cupo_sugerido": None,
        "cuota_sugerida": None,
        "tasa_preselecta": None,
        "monto_maximo_aprobado": None,
        
        # Deuda total
        "valor_inicial_cupo": None,
        "saldo_actual_deuda": None,
        "pct_total_deuda": None,
        "saldo_mora": None,
        
        # Contadores
        "obligaciones_reestructuradas": 0,
        "obligaciones_cobro_juridico": 0,
    }

    if not texto:
        return data

    # ── Cédula ──────────────────────────────────────────────────────────────
    ced_m = re.search(r'N[úu]mero\s*de\s*Documento\s*:\s*(\d{7,10})', texto, re.IGNORECASE)
    if not ced_m:
        ced_m = re.search(r'C[eé]dula\s*(?:de\s*Ciudadan[íi]a)?\s*[:\-]?\s*(\d{7,10})', texto, re.IGNORECASE)
    if ced_m:
        data["cedula"] = ced_m.group(1)
    elif filename:
        fn_m = re.search(r'(\d{7,10})', filename)
        if fn_m:
            data["cedula"] = fn_m.group(1)

    # ── Nombres y Apellidos ─────────────────────────────────────────────────
    nom_m = re.search(r'Nombres?\s*y\s*Apellidos?\s*:\s*(.+)', texto, re.IGNORECASE)
    if not nom_m:
        nom_m = re.search(r'Nombre(?:\s+Completo)?\s*:\s*(.+)', texto, re.IGNORECASE)
    if nom_m:
        full_name = nom_m.group(1).strip()
        parts = full_name.split()
        if len(parts) >= 4:
            data["apellidos"] = " ".join(parts[:2])
            data["nombres"] = " ".join(parts[2:])
        elif len(parts) >= 2:
            data["apellidos"] = parts[0]
            data["nombres"] = " ".join(parts[1:])

    # ── Edad y Género ───────────────────────────────────────────────────────
    edad_m = re.search(r'Edad:\s*(\d+\s*a\s*\d+\s*a[ñn]os)', texto, re.IGNORECASE)
    if edad_m:
        data["edad_rango"] = edad_m.group(1)
    
    gen_m = re.search(r'G[ée]nero:\s*(Masculino|Femenino)', texto, re.IGNORECASE)
    if gen_m:
        data["genero"] = gen_m.group(1)

    # ── Decisión Preselecta ─────────────────────────────────────────────────
    dec_m = re.search(r'Decisi[óo]n\s*:\s*(Aprobado|Rechazado|Estudio|APROBADO|RECHAZADO|ESTUDIO)', texto, re.IGNORECASE)
    if dec_m:
        data["decision_preselecta"] = dec_m.group(1).capitalize()

    # ── Score Acierta Más ───────────────────────────────────────────────────
    # Try multiple patterns for score: "Acierta Más: 720", "Acierta Mas: 720", "Score: 720"
    score_m = re.search(r'Acierta\s*M[áa]s\s*:\s*(\d{1,3})', texto, re.IGNORECASE)
    if not score_m:
        score_m = re.search(r'(?:SCORE|Puntaje)\s*Acierta\s*M[áa]s\s*[:\-]?\s*(\d{1,3})', texto, re.IGNORECASE)
    if not score_m:
        score_m = re.search(r'(?:Score|Puntaje)\s*[:\-]\s*(\d{3})\b', texto, re.IGNORECASE)
    if score_m:
        data["score_acierta_mas"] = int(score_m.group(1))

    # ── QUANTO ingreso medio ────────────────────────────────────────────────
    quanto_m = re.search(r'Quanto3?\s*Valor\s*Medio\s*:\s*([\d.,]+)', texto, re.IGNORECASE)
    if not quanto_m:
        quanto_m = re.search(r'Ingreso\s*(?:Medio|Estimado)\s*:\s*([\d.,]+)', texto, re.IGNORECASE)
    if quanto_m:
        try:
            data["quanto_ingreso_medio"] = float(quanto_m.group(1).replace(',', ''))
        except ValueError:
            pass

    # ── Perfil Score ────────────────────────────────────────────────────────
    perfil_m = re.search(r'PERFIL_SCORE:\s*(Alto|Medio|Bajo|NA)', texto, re.IGNORECASE)
    if perfil_m:
        data["perfil_score"] = perfil_m.group(1)

    # ── Variables del bloque de respuesta personalizada ─────────────────────
    def extract_var(name, default=0):
        # Try both "- VAR_NAME: 0" and "VAR_NAME: 0" and "VAR_NAME = 0" formats
        m = re.search(rf'(?:-\s*)?{re.escape(name)}\s*[:\=]\s*([\d.]+)', texto, re.IGNORECASE)
        if m:
            try:
                return int(float(m.group(1)))
            except ValueError:
                return default
        return default

    data["embargos"] = extract_var("VAR_EMBARGOS")
    data["cancelaciones_negativas_12m"] = extract_var("VAR_CANCELACIONES_NEGATIVAS_ULT12")
    data["cartera_recuperada"] = extract_var("VAR_CARTERA_RECUPERADA_TIT_RECH")
    data["cartera_castigada"] = extract_var("VAR_CARTERA_CASTIGADA_TIT_RECH")
    data["dudoso_recaudo"] = extract_var("VAR_DUDOSO_RECAUDO_TIT_RECH")
    data["mora_30_vigente"] = extract_var("VAR_MORA30_VIGENTE_TIT_RECH")
    data["mora_60_vigente"] = extract_var("VAR_MORA60_VIGENTE_TIT_RECH")
    data["mora_90_vigente"] = extract_var("VAR_MORA90_VIGENTE_TIT_RECH")
    data["mora_120_vigente"] = extract_var("VAR_MORA120_VIGENTE_TIT_RECH")
    data["mora_30_hist_12m"] = extract_var("VAR_MORA30_ULT12M_TIT_RECH")
    data["mora_60_hist_12m"] = extract_var("VAR_MORA60_ULT12M_TIT_RECH")
    data["mora_90_hist_12m"] = extract_var("VAR_MORA90_ULT12M_TIT_RECH")
    data["mora_120_hist_12m"] = extract_var("VAR_MORA120_ULT12M_TIT_RECH")
    data["obligaciones_reestructuradas"] = extract_var("CONTEO_OBLI_REEST")
    data["obligaciones_cobro_juridico"] = extract_var("CONTEO_OBLI_COBRO_JURIDICO")

    # ── Variables financieras ───────────────────────────────────────────────
    def extract_float_var(name):
        # Try both "- VAR_NAME: 1234" and "VAR_NAME: 1234" and "VAR_NAME = 1234" formats
        m = re.search(rf'(?:-\s*)?{re.escape(name)}\s*[:\=]\s*([\d.,]+)', texto, re.IGNORECASE)
        if m:
            try:
                return float(m.group(1).replace(',', '').replace('.', '', m.group(1).count('.') - 1) if m.group(1).count('.') > 1 else m.group(1).replace(',', ''))
            except ValueError:
                return None
        return None

    data["ingresos_quanto"] = extract_float_var("INGRESOS")
    data["gastos_financieros_no_rotativos"] = extract_float_var("GASTOS_FINANCIEROS_NO_ROTATIVOS")
    data["gastos_financieros_rotativos"] = extract_float_var("GASTOS_FINANCIEROS_ROTATIVOS")
    data["gastos_personales"] = extract_float_var("GASTOS_PERSONALES")
    data["disponible"] = extract_float_var("DISPONIBLE")
    data["pct_endeudamiento"] = extract_float_var("PORC_ENDEUDAMIENTO")
    data["cupo_sugerido"] = extract_float_var("CUPO_SUGERIDO")
    data["cuota_sugerida"] = extract_float_var("CUOTA_SUGERIDA")
    data["tasa_preselecta"] = extract_float_var("TASA")
    data["monto_maximo_aprobado"] = extract_float_var("MONTO_MAXIMO_APROBADO")
    data["valor_inicial_cupo"] = extract_float_var("VALOR_INICIAL_CUPO")
    data["saldo_actual_deuda"] = extract_float_var("SALDO_ACTUAL_DEUDA")
    data["pct_total_deuda"] = extract_float_var("PORCENTAJE_TOTAL_DEUDA")
    data["saldo_mora"] = extract_float_var("SALDO_MORA")

    # ── SCORE desde respuesta personalizada ─────────────────────────────────
    if not data["score_acierta_mas"]:
        score_resp = re.search(r'-\s*SCORE:\s*(\d{1,3})', texto, re.IGNORECASE)
        if score_resp:
            data["score_acierta_mas"] = int(score_resp.group(1))

    # ── Decisión desde respuesta personalizada ──────────────────────────────
    if not data["decision_preselecta"]:
        dec_resp = re.search(r'-\s*DECISION:\s*(Aprobado|Rechazado|Estudio)', texto, re.IGNORECASE)
        if dec_resp:
            data["decision_preselecta"] = dec_resp.group(1).capitalize()

    log.info(
        f"Preselecta extraído: CC={data['cedula']} Score={data['score_acierta_mas']} "
        f"Decisión={data['decision_preselecta']} QUANTO={data['quanto_ingreso_medio']} "
        f"Endeud={data['pct_endeudamiento']}%"
    )
    return data
