"""
Extractor de consultas ADRES (FOSYGA/BDUA)
Parsea PDFs de la Administradora de los Recursos del Sistema General de Seguridad Social en Salud.
"""
import re
import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)


def extraer_adres(texto: str, filename: str = "") -> dict:
    """
    Extrae datos relevantes de una consulta ADRES/BDUA.
    
    Args:
        texto: Texto extraído del PDF de ADRES
        filename: Nombre del archivo (para fallback de cédula)
    
    Returns:
        dict con campos: cedula, nombres, apellidos, estado_adres, regimen,
                         tipo_afiliado, entidad_eps, fecha_afiliacion, departamento, municipio
    """
    data = {
        "cedula": None,
        "nombres": None,
        "apellidos": None,
        "estado_adres": None,          # ACTIVO / INACTIVO / RETIRADO
        "regimen": None,               # CONTRIBUTIVO / SUBSIDIADO
        "tipo_afiliado": None,         # COTIZANTE / BENEFICIARIO
        "entidad_eps": None,
        "fecha_afiliacion": None,
        "fecha_finalizacion": None,
        "departamento": None,
        "municipio": None,
    }

    if not texto:
        return data

    # ── Cédula ──────────────────────────────────────────────────────────────
    ced_m = re.search(
        r'(?:N[ÚU]MERO\s+DE\s*\n?\s*IDENTIFICACI[OÓ]N|IDENTIFICACI[OÓ]N)\s*\n?\s*(\d{6,12})',
        texto, re.IGNORECASE
    )
    if ced_m:
        data["cedula"] = ced_m.group(1).strip()
    elif filename:
        fn_m = re.search(r'(\d{7,10})', filename)
        if fn_m:
            data["cedula"] = fn_m.group(1)

    # ── Nombres ─────────────────────────────────────────────────────────────
    nom_m = re.search(r'NOMBRES\s+([A-ZÁÉÍÓÚÑ ]+)', texto, re.IGNORECASE)
    if nom_m:
        data["nombres"] = nom_m.group(1).strip()

    # ── Apellidos ───────────────────────────────────────────────────────────
    ape_m = re.search(r'APELLIDOS\s+([A-ZÁÉÍÓÚÑ ]+)', texto, re.IGNORECASE)
    if ape_m:
        data["apellidos"] = ape_m.group(1).strip()

    # ── Departamento ────────────────────────────────────────────────────────
    dep_m = re.search(r'DEPARTAMENTO\s+([A-ZÁÉÍÓÚÑ\s.]+?)(?:\n|MUNICIPIO)', texto, re.IGNORECASE)
    if dep_m:
        data["departamento"] = dep_m.group(1).strip()

    # ── Municipio ───────────────────────────────────────────────────────────
    mun_m = re.search(r'MUNICIPIO\s+([A-ZÁÉÍÓÚÑ\s.]+?)(?:\n|Datos)', texto, re.IGNORECASE)
    if mun_m:
        data["municipio"] = mun_m.group(1).strip()

    # ── Estado de Afiliación ────────────────────────────────────────────────
    # Buscar patrón: ACTIVO/INACTIVO/RETIRADO seguido de CONTRIBUTIVO/SUBSIDIADO
    estado_m = re.search(
        r'(ACTIVO|INACTIVO|RETIRADO|SUSPENDIDO)\s+'
        r'(?:[A-ZÁÉÍÓÚÑ\s.]+?\s+)?'  # Nombre de la entidad (opcional)
        r'(CONTRIBUTIVO|SUBSIDIADO)',
        texto, re.IGNORECASE
    )
    if estado_m:
        data["estado_adres"] = estado_m.group(1).upper()
        data["regimen"] = estado_m.group(2).upper()
    else:
        # Fallback: buscar solo el estado
        estado_solo = re.search(r'\b(ACTIVO|INACTIVO|RETIRADO|SUSPENDIDO)\b', texto, re.IGNORECASE)
        if estado_solo:
            data["estado_adres"] = estado_solo.group(1).upper()
        regimen_solo = re.search(r'\b(CONTRIBUTIVO|SUBSIDIADO)\b', texto, re.IGNORECASE)
        if regimen_solo:
            data["regimen"] = regimen_solo.group(1).upper()

    # ── Tipo de afiliado ────────────────────────────────────────────────────
    tipo_m = re.search(r'(COTIZANTE|BENEFICIARIO|ADICIONAL)', texto, re.IGNORECASE)
    if tipo_m:
        data["tipo_afiliado"] = tipo_m.group(1).upper()

    # ── Entidad EPS ─────────────────────────────────────────────────────────
    # Buscar entre el estado y las fechas
    eps_patterns = [
        r'ENTIDAD\s+PROMOTORA\s+DE\s+SALUD\s+([A-ZÁÉÍÓÚÑ\s.,-]+?)(?:\n|S\.A)',
        r'(?:ACTIVO|INACTIVO)\s+([A-ZÁÉÍÓÚÑ\s.,-]+?)\s+(?:CONTRIBUTIVO|SUBSIDIADO)',
    ]
    for pat in eps_patterns:
        eps_m = re.search(pat, texto, re.IGNORECASE)
        if eps_m:
            eps_name = eps_m.group(1).strip()
            # Limpiar nombre de EPS
            eps_name = re.sub(r'\s+', ' ', eps_name)
            if len(eps_name) > 3 and eps_name not in ("ACTIVO", "INACTIVO"):
                data["entidad_eps"] = eps_name
                break

    # Buscar EPS conocidas como fallback
    if not data["entidad_eps"]:
        eps_conocidas = [
            "SANITAS", "SURA", "NUEVA EPS", "SALUD TOTAL", "COOMEVA",
            "FAMISANAR", "COMPENSAR", "COLSANITAS", "MUTUAL SER",
            "COOSALUD", "COMFAMILIAR", "CAPITAL SALUD", "MEDIMAS",
        ]
        for eps in eps_conocidas:
            if eps.upper() in texto.upper():
                data["entidad_eps"] = eps
                break

    # ── Fecha de afiliación ─────────────────────────────────────────────────
    fecha_m = re.search(r'(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})', texto)
    if fecha_m:
        data["fecha_afiliacion"] = fecha_m.group(1)
        data["fecha_finalizacion"] = fecha_m.group(2)

    log.info(
        f"ADRES extraído: CC={data['cedula']} Estado={data['estado_adres']} "
        f"Régimen={data['regimen']} EPS={data['entidad_eps']}"
    )
    return data
