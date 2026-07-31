"""
Extractor de solicitudes Witme / Finalco (PDF)
Extrae información detallada del formulario de solicitud del cliente.
"""
import re
import logging
from typing import Optional

log = logging.getLogger(__name__)


def parse_date(date_str: str) -> Optional[str]:
    """Convierte fechas del formato DD/MM/YYYY a YYYY-MM-DD."""
    if not date_str:
        return None
    date_str = date_str.strip()
    m = re.search(r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', date_str)
    if m:
        day, month, year = m.group(1), m.group(2), m.group(3)
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return date_str


def parse_float(num_str: str) -> Optional[float]:
    """Limpia formatos numéricos colombianos (ej: 489.950 o 3700000) a float."""
    if not num_str:
        return None
    try:
        cleaned = num_str.strip()
        # Eliminar puntos si actúan como separadores de miles
        # (patrón de punto seguido de exactamente 3 dígitos al final o antes de no-dígito)
        cleaned = re.sub(r'\.(\d{3})(?=\D|$)', r'\1', cleaned)
        cleaned = cleaned.replace('.', '')
        cleaned = cleaned.replace(',', '.')
        return float(cleaned)
    except Exception:
        return None


def split_name(full_name: str) -> tuple[str, str]:
    """Separa el nombre completo en nombres y apellidos para el sistema."""
    if not full_name:
        return "", ""
    parts = full_name.strip().split()
    if len(parts) == 1:
        return "", parts[0]
    elif len(parts) == 2:
        return parts[0], parts[1]
    elif len(parts) == 3:
        return parts[0], " ".join(parts[1:])
    else:
        # Para 4 o más palabras: se asumen las 2 primeras como nombres
        return " ".join(parts[:2]), " ".join(parts[2:])


def extraer_witme(texto: str, filename: str = "") -> dict:
    """
    Extrae información estructurada del formulario de solicitud Witme.
    """
    data = {
        "cedula": None,
        "nombres": None,
        "apellidos": None,
        "nombre_completo": None,
        "email": None,
        "telefono": None,
        "genero": None,
        "estado_civil": None,
        "fecha_nacimiento": None,
        "edad": None,
        "fecha_expedicion": None,
        "monto_solicitado": None,
        "plazo_solicitado": None,
        "valor_cuota": None,
        "destino_credito": None,
        "departamento": None,
        "municipio": None,
        "ingresos_mensuales": None,
        "otros_ingresos": None,
        "descripcion_otros_ingresos": None,
        "numero_hijos": None,
        "personas_a_cargo": None,
        "estrato": None,
        "direccion": None,
        "barrio": None,
        "situacion_vivienda": None,
        "tipo_vivienda": None,
        "nivel_educacion": None,
        "ocupacion": None,
        "empresa_trabaja": None,
        "cargo": None,
        "fecha_ingreso": None,
        "tipo_contrato": None,
        "profesion": None,
        "tiene_vehiculo": False,
        "tiene_propiedad": False,
        "banco_tipo_cuenta": None,
        "banco_entidad": None,
        "banco_numero_cuenta": None
    }

    if not texto:
        return data

    # Helper para búsquedas de una sola línea limpias
    def find_line(pattern: str, text: str) -> Optional[str]:
        m = re.search(pattern, text, re.IGNORECASE)
        return m.group(1).strip() if m else None

    # ── Cédula / DNI ────────────────────────────────────────────────────────
    ced_m = re.search(r'\b(?:DNI|CC)\b[:.\s]*(\d+)', texto, re.IGNORECASE)
    if ced_m:
        data["cedula"] = ced_m.group(1).strip()
    elif filename:
        fn_m = re.search(r'(\d{7,10})', filename)
        if fn_m:
            data["cedula"] = fn_m.group(1)

    # ── Nombre y apellido ───────────────────────────────────────────────────
    data["nombre_completo"] = find_line(r'\bNombre\s+y\s+apellido\b[:.\s]*([^\n\r]+)', texto)
    if data["nombre_completo"]:
        data["nombres"], data["apellidos"] = split_name(data["nombre_completo"])

    # ── Email ───────────────────────────────────────────────────────────────
    data["email"] = find_line(r'\bE-Mail\b[:.\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', texto)

    # ── Teléfono Celular ────────────────────────────────────────────────────
    data["telefono"] = find_line(r'\bTel[ée]fono\s+Celular\b[:.\s]*([+\d\s]+)', texto)

    # ── Capital Seleccionado ────────────────────────────────────────────────
    data["monto_solicitado"] = parse_float(find_line(r'\bCapital\s+Seleccionado\b[:.\s]*([\d.,]+)', texto))

    # ── Cantidad de Cuotas ──────────────────────────────────────────────────
    plazo_str = find_line(r'\bCantidad\s+de\s+Cuotas\b[:.\s]*(\d+)', texto)
    if plazo_str:
        data["plazo_solicitado"] = int(plazo_str)

    # ── Valor de Cuota ──────────────────────────────────────────────────────
    data["valor_cuota"] = parse_float(find_line(r'\bValor\s+de\s+Cuota\b[:.\s]*([\d.,]+)', texto))

    # ── Género ──────────────────────────────────────────────────────────────
    gen = find_line(r'\bGener[oo]\b[:.\s]*([a-zA-Záéíóúñ]+)', texto)
    if gen:
        data["genero"] = gen.capitalize()

    # ── Estado Civil ────────────────────────────────────────────────────────
    ec = find_line(r'\bEstado\s+civil\b[:.\s]*([a-zA-Záéíóúñ]+)', texto)
    if ec:
        data["estado_civil"] = ec.capitalize()

    # ── Fecha de nacimiento ─────────────────────────────────────────────────
    data["fecha_nacimiento"] = parse_date(find_line(r'\bFecha\s+de\s+nacimiento\b[:.\s]*([\d/-]+)', texto))

    # ── Edad ────────────────────────────────────────────────────────────────
    edad_str = find_line(r'\bEdad\b[:.\s]*(\d+)', texto)
    if edad_str:
        data["edad"] = int(edad_str)

    # ── Fecha de expedición ─────────────────────────────────────────────────
    data["fecha_expedicion"] = parse_date(find_line(r'\bFecha\s+de\s+expedici[oó]n\b[:.\s]*([\d/-]+)', texto))

    # ── Destino del crédito ─────────────────────────────────────────────────
    data["destino_credito"] = find_line(r'\bDestino\s+del\s+cr[eé]dito\b[:.\s]*([^\n\r]+)', texto)

    # ── Departamento / Municipio ────────────────────────────────────────────
    data["departamento"] = find_line(r'\bDepartamento\b[:.\s]*([^\n\r]+)', texto)
    data["municipio"] = find_line(r'\bMunicipio\b[:.\s]*([^\n\r]+)', texto)

    # ── Ingresos mensuales ──────────────────────────────────────────────────
    data["ingresos_mensuales"] = parse_float(find_line(r'\bIngresos\s+mensuales\b[:.\s]*([\d.,]+)', texto))

    # ── Otros ingresos ──────────────────────────────────────────────────────
    data["otros_ingresos"] = parse_float(find_line(r'\bOtros\s+ingresos\b[:.\s]*([\d.,]+)', texto))
    data["descripcion_otros_ingresos"] = find_line(r'\bDescripci[oó]n\s+de\s+otros\s+ingresos\b[:.\s]*([^\n\r]+)', texto)

    # ── Hijos y Personas a cargo ────────────────────────────────────────────
    hijos_str = find_line(r'\bN[uú]mero\s+de\s+hijos\b[:.\s]*(\d+)', texto)
    if hijos_str:
        data["numero_hijos"] = int(hijos_str)

    cargo_str = find_line(r'\bN[uú]mero\s+de\s+personas\s+a\s+cargo\b[:.\s]*(\d+)', texto)
    if cargo_str:
        data["personas_a_cargo"] = int(cargo_str)

    # ── Estrato ─────────────────────────────────────────────────────────────
    estrato_str = find_line(r'\bEstrato\b[:.\s]*(\d+)', texto)
    if estrato_str:
        data["estrato"] = int(estrato_str)

    # ── Dirección y Barrio ──────────────────────────────────────────────────
    dir_matches = re.findall(r'\bDirecci[oó]n\b[:.\s]*([^\n\r]+)', texto, re.IGNORECASE)
    for dm in dir_matches:
        dm_clean = dm.strip()
        if dm_clean and "validación" not in dm_clean.lower() and "no solicitado" not in dm_clean.lower():
            data["direccion"] = dm_clean
            break

    data["barrio"] = find_line(r'\bBarrio\b[:.\s]*([^\n\r]+)', texto)

    # ── Vivienda (Situación) ────────────────────────────────────────────────
    data["situacion_vivienda"] = find_line(r'\bSituaci[oó]n\s+de\s+vivienda\b[:.\s]*([^\n\r]+)', texto)
    data["tipo_vivienda"] = find_line(r'\bTipo\s+de\s+vivienda\b[:.\s]*([^\n\r]+)', texto)

    # ── Vivienda / Vehículo (Propiedad - Sí/No) ─────────────────────────────
    viv_prop_m = re.search(r'\bVivienda\s+(S[íi]|No)\b', texto, re.IGNORECASE)
    if viv_prop_m:
        data["tiene_propiedad"] = viv_prop_m.group(1).lower() in ("sí", "si")

    veh_prop_m = re.search(r'\bVeh[ií]culo\s+(S[íi]|No)\b', texto, re.IGNORECASE)
    if veh_prop_m:
        data["tiene_vehiculo"] = veh_prop_m.group(1).lower() in ("sí", "si")

    # ── Educación y Actividad Económica ─────────────────────────────────────
    data["nivel_educacion"] = find_line(r'\bNivel\s+de\s+educaci[oó]n\b[:.\s]*([^\n\r]+)', texto)
    data["ocupacion"] = find_line(r'\bOcupaci[oó]n\s+u\s+Oficio\b[:.\s]*([^\n\r]+)', texto)
    data["empresa_trabaja"] = find_line(r'\bEmpresa\s+donde\s+trabaja\b[:.\s]*([^\n\r]+)', texto)
    
    # Anclamos Cargo al principio de línea para evitar colisiones con "personas a cargo"
    cargo_m = re.search(r'^\s*Cargo\b[:.\s]*([^\n\r]+)', texto, re.IGNORECASE | re.MULTILINE)
    if cargo_m:
        data["cargo"] = cargo_m.group(1).strip()

    data["fecha_ingreso"] = parse_date(find_line(r'\bFecha\s+de\s+ingreso\b[:.\s]*([\d/-]+)', texto))
    data["tipo_contrato"] = find_line(r'\bTipo\s+de\s+contrato\b[:.\s]*([^\n\r]+)', texto)
    data["profesion"] = find_line(r'\bProfesi[oó]n\b[:.\s]*([^\n\r]+)', texto)

    # ── Datos bancarios ─────────────────────────────────────────────────────
    data["banco_tipo_cuenta"] = find_line(r'\bTipo\s+de\s+cuenta\b[:.\s]*([^\n\r]+)', texto)
    data["banco_entidad"] = find_line(r'\bEntidad\b[:.\s]*([^\n\r]+)', texto)
    
    bnc_str = find_line(r'\bN[uú]mero\s+de\s+cuenta\b[:.\s]*(\d+)', texto)
    if bnc_str:
        data["banco_numero_cuenta"] = bnc_str

    # Log de depuración
    log.info(
        f"Witme extraído: CC={data['cedula']} Nombre={data['nombre_completo']} "
        f"Monto={data['monto_solicitado']} Ingresos={data['ingresos_mensuales']}"
    )

    return data
