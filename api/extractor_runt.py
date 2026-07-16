"""
Extractor de consultas RUNT (Registro Único Nacional de Tránsito)
Extrae información de vehículos registrados a nombre del cliente.
"""
import re
import logging

log = logging.getLogger(__name__)


def extraer_runt(texto: str, filename: str = "") -> dict:
    """
    Extrae datos de una consulta RUNT.
    
    Args:
        texto: Texto extraído del PDF de RUNT
        filename: Nombre del archivo para fallback de cédula
    
    Returns:
        dict con campos del vehículo y propiedad
    """
    data = {
        "cedula": None,
        "tiene_vehiculo": False,
        "vehiculos": [],
        "valor_estimado_activos": 0,
    }

    if not texto:
        return data

    # ── Cédula del nombre del archivo ───────────────────────────────────────
    if filename:
        fn_m = re.search(r'(\d{7,10})', filename)
        if fn_m:
            data["cedula"] = fn_m.group(1)

    # ── Detectar si hay información de vehículo ─────────────────────────────
    if re.search(r'(?:MARCA|MODELO|LÍNEA|VEH[ÍI]CULO|PLACA|CHASIS)', texto, re.IGNORECASE):
        data["tiene_vehiculo"] = True

        vehiculo = {
            "marca": None,
            "linea": None,
            "modelo": None,
            "color": None,
            "cilindrada": None,
            "tipo_carroceria": None,
            "combustible": None,
            "fecha_matricula": None,
            "placa": None,
            "gravamenes": None,
        }

        # ── Marca ──────────────────────────────────────────────────────────
        marca_m = re.search(r'MARCA:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\s{2,}|L[ÍI]NEA)', texto, re.IGNORECASE)
        if marca_m:
            vehiculo["marca"] = marca_m.group(1).strip()

        # ── Línea ──────────────────────────────────────────────────────────
        linea_m = re.search(r'L[ÍI]NEA:\s*([A-ZÁÉÍÓÚÑ0-9\s]+?)(?:\s{2,}|$|\n)', texto, re.IGNORECASE)
        if linea_m:
            vehiculo["linea"] = linea_m.group(1).strip()

        # ── Modelo (año) ───────────────────────────────────────────────────
        modelo_m = re.search(r'MODELO:\s*(\d{4})', texto, re.IGNORECASE)
        if modelo_m:
            vehiculo["modelo"] = int(modelo_m.group(1))

        # ── Color ──────────────────────────────────────────────────────────
        color_m = re.search(r'COLOR:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\s{2,}|$|\n)', texto, re.IGNORECASE)
        if color_m:
            vehiculo["color"] = color_m.group(1).strip()

        # ── Cilindraje ─────────────────────────────────────────────────────
        cil_m = re.search(r'CILINDRA(?:JE|DA):\s*(\d+)', texto, re.IGNORECASE)
        if cil_m:
            vehiculo["cilindrada"] = int(cil_m.group(1))

        # ── Tipo carrocería ────────────────────────────────────────────────
        tipo_m = re.search(r'TIPO\s+DE\s*\n?\s*CARROCER[ÍI]A:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\s{2,}|$|\n)', texto, re.IGNORECASE)
        if tipo_m:
            vehiculo["tipo_carroceria"] = tipo_m.group(1).strip()

        # ── Combustible ────────────────────────────────────────────────────
        comb_m = re.search(r'TIPO\s+COMBUSTIBLE:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\s{2,}|$|\n)', texto, re.IGNORECASE)
        if comb_m:
            vehiculo["combustible"] = comb_m.group(1).strip()

        # ── Fecha matrícula ────────────────────────────────────────────────
        fecha_m = re.search(r'FECHA\s+DE\s+MATRICULA\s*\n?\s*(?:INICIAL)?\s*(?:\(DD/MM/AAAA\))?\s*:?\s*(\d{2}/\d{2}/\d{4})', texto, re.IGNORECASE)
        if fecha_m:
            vehiculo["fecha_matricula"] = fecha_m.group(1)

        # ── Gravámenes ─────────────────────────────────────────────────────
        grav_m = re.search(r'GRAV[ÁA]MENES\s+A\s+LA\s*\n?\s*PROPIEDAD:\s*(SI|NO)', texto, re.IGNORECASE)
        if grav_m:
            vehiculo["gravamenes"] = grav_m.group(1).upper()

        # ── Placa ──────────────────────────────────────────────────────────
        placa_m = re.search(r'PLACA:\s*([A-Z]{3}\d{3})', texto, re.IGNORECASE)
        if placa_m:
            vehiculo["placa"] = placa_m.group(1).upper()

        data["vehiculos"].append(vehiculo)

        # ── Estimación del valor del activo ────────────────────────────────
        # Basado en modelo/año — estimación muy básica para referencia
        if vehiculo["modelo"]:
            import datetime
            edad_vehiculo = datetime.date.today().year - vehiculo["modelo"]
            # Estimación base según cilindraje y edad
            base = 15_000_000 if (vehiculo.get("cilindrada") or 0) < 1500 else 25_000_000
            depreciacion = max(0.1, 1 - (edad_vehiculo * 0.08))
            data["valor_estimado_activos"] = round(base * depreciacion, -3)

    log.info(
        f"RUNT extraído: CC={data['cedula']} TieneVehículo={data['tiene_vehiculo']} "
        f"Vehículos={len(data['vehiculos'])} ValorEst=${data['valor_estimado_activos']:,.0f}"
    )
    return data
