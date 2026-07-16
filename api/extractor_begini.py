"""
Extractor de reportes Begini (prueba psicométrica comportamental)
Los PDFs de Begini suelen ser imágenes escaneadas, por lo que este extractor
usa OCR como primera opción y Claude como fallback.

Escala Begini (0-8):
  0 = No contestó
  1 = Highest Risk (Riesgo más alto)
  2 = Very High Risk (Riesgo muy alto)
  3 = High Risk (Riesgo alto)
  4 = Medium Risk (Riesgo medio)
  5 = Low Risk (Riesgo bajo)
  6 = Very Low Risk (Riesgo muy bajo)
  7 = Lowest Risk (Riesgo más bajo)
  8 = No terminó
"""
import re
import logging
from typing import Optional

log = logging.getLogger(__name__)

# Mapeo de nivel de riesgo Begini
BEGINI_RISK_MAP = {
    0: {"nivel": "No contestó",     "riesgo_normalizado": "sin_dato"},
    1: {"nivel": "Highest Risk",    "riesgo_normalizado": "muy_alto"},
    2: {"nivel": "Very High Risk",  "riesgo_normalizado": "muy_alto"},
    3: {"nivel": "High Risk",       "riesgo_normalizado": "alto"},
    4: {"nivel": "Medium Risk",     "riesgo_normalizado": "medio"},
    5: {"nivel": "Low Risk",        "riesgo_normalizado": "bajo"},
    6: {"nivel": "Very Low Risk",   "riesgo_normalizado": "muy_bajo"},
    7: {"nivel": "Lowest Risk",     "riesgo_normalizado": "muy_bajo"},
    8: {"nivel": "No terminó",      "riesgo_normalizado": "sin_dato"},
}

# Palabras clave para detectar nivel de riesgo en texto OCR
RISK_KEYWORDS = {
    "highest risk":    1,
    "very high risk":  2,
    "high risk":       3,
    "medium risk":     4,
    "low risk":        5,
    "very low risk":   6,
    "lowest risk":     7,
    "riesgo mas alto": 1,
    "riesgo muy alto": 2,
    "riesgo alto":     3,
    "riesgo medio":    4,
    "riesgo bajo":     5,
    "riesgo muy bajo": 6,
    "riesgo mas bajo": 7,
}


def extraer_begini(texto: str, filename: str = "") -> dict:
    """
    Extrae datos de un reporte de prueba psicométrica Begini.
    
    Args:
        texto: Texto extraído del PDF (puede estar vacío si es imagen)
        filename: Nombre del archivo para fallback de cédula
    
    Returns:
        dict con campos: cedula, score_begini (0-8), nivel_riesgo_begini,
                         riesgo_normalizado, tiene_begini, recomendacion
    """
    data = {
        "cedula": None,
        "score_begini": None,          # 0-8
        "nivel_riesgo_begini": None,   # "Very High Risk", etc.
        "riesgo_normalizado": None,    # muy_alto/alto/medio/bajo/muy_bajo/sin_dato
        "tiene_begini": False,
        "recomendacion": None,
    }

    # ── Cédula del nombre del archivo ───────────────────────────────────────
    if filename:
        fn_m = re.search(r'(\d{7,10})', filename)
        if fn_m:
            data["cedula"] = fn_m.group(1)

    # Si no hay texto (PDF es imagen pura), marcar como sin datos
    if not texto or len(texto.strip()) < 10:
        log.info(f"Begini: PDF sin texto extraíble ({filename}). Requiere OCR o análisis visual.")
        data["tiene_begini"] = True  # El archivo existe pero no pudimos leerlo
        return data

    # ── Buscar score numérico (0-8) ─────────────────────────────────────────
    score_m = re.search(r'(?:score|puntaje|resultado)\s*:?\s*(\d)', texto, re.IGNORECASE)
    if score_m:
        score = int(score_m.group(1))
        if 0 <= score <= 8:
            data["score_begini"] = score
            risk_info = BEGINI_RISK_MAP.get(score, {})
            data["nivel_riesgo_begini"] = risk_info.get("nivel")
            data["riesgo_normalizado"] = risk_info.get("riesgo_normalizado")
            data["tiene_begini"] = True

    # ── Buscar nivel de riesgo por texto ────────────────────────────────────
    if not data["score_begini"]:
        texto_lower = texto.lower()
        for keyword, score in RISK_KEYWORDS.items():
            if keyword in texto_lower:
                data["score_begini"] = score
                risk_info = BEGINI_RISK_MAP.get(score, {})
                data["nivel_riesgo_begini"] = risk_info.get("nivel")
                data["riesgo_normalizado"] = risk_info.get("riesgo_normalizado")
                data["tiene_begini"] = True
                break

    # ── Buscar cédula en el texto ───────────────────────────────────────────
    if not data["cedula"]:
        ced_m = re.search(r'(?:c[eé]dula|cc|documento|identificaci[oó]n)\s*:?\s*(\d{7,10})', texto, re.IGNORECASE)
        if ced_m:
            data["cedula"] = ced_m.group(1)

    # ── Recomendación ───────────────────────────────────────────────────────
    rec_m = re.search(r'(?:recomendaci[oó]n|conclusi[oó]n)\s*:?\s*(.+?)(?:\n|$)', texto, re.IGNORECASE)
    if rec_m:
        data["recomendacion"] = rec_m.group(1).strip()

    log.info(
        f"Begini extraído: CC={data['cedula']} Score={data['score_begini']} "
        f"Riesgo={data['nivel_riesgo_begini']}"
    )
    return data


def ajuste_puntaje_begini(score_begini: Optional[int]) -> int:
    """
    Calcula el ajuste al puntaje del motor de decisión basado en Begini.
    
    Retorna un valor entre -5 y +5 que se suma/resta al puntaje base.
    
    Escala:
      7 (Lowest Risk):     +5
      6 (Very Low Risk):   +3
      5 (Low Risk):        +2
      4 (Medium Risk):      0
      3 (High Risk):       -2
      2 (Very High Risk):  -3
      1 (Highest Risk):    -5
      0 (No contestó):      0
      8 (No terminó):       0
      None (sin dato):      0
    """
    if score_begini is None:
        return 0
    
    ajustes = {
        0: 0,    # No contestó
        1: -5,   # Highest Risk
        2: -3,   # Very High Risk
        3: -2,   # High Risk
        4: 0,    # Medium Risk
        5: 2,    # Low Risk
        6: 3,    # Very Low Risk
        7: 5,    # Lowest Risk
        8: 0,    # No terminó
    }
    return ajustes.get(score_begini, 0)
