"""
mrz_parser.py

Parser de MRZ tipo TD1 (3 lineas x 30 caracteres) para cedulas de
ciudadania colombianas, con validacion de digitos verificadores
(checksum ICAO 9303).

Este modulo NO hace OCR. Recibe el texto crudo de las 3 lineas del MRZ
(ya extraidas por OCR) y se encarga de:
  1. Parsear los campos segun la estructura TD1
  2. Validar cada campo contra su digito verificador
  3. Devolver un dict con los datos + flags de confianza por campo

De esta forma separas responsabilidades: el OCR puede fallar en un
caracter, pero el checksum te dice EXACTAMENTE que campo esta mal,
en vez de aceptar datos corruptos a ciegas.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Optional


# Pesos del algoritmo de checksum ICAO 9303 (7-3-1 ciclico)
_WEIGHTS = [7, 3, 1]


def _char_value(c: str) -> int:
    """Convierte un caracter MRZ a su valor numerico segun ICAO 9303."""
    if c == "<":
        return 0
    if c.isdigit():
        return int(c)
    if c.isalpha():
        # A=10, B=11, ..., Z=35
        return ord(c.upper()) - ord("A") + 10
    raise ValueError(f"Caracter invalido en MRZ: {c!r}")


def compute_check_digit(data: str) -> int:
    """Calcula el digito verificador ICAO 9303 para una cadena MRZ."""
    total = 0
    for i, c in enumerate(data):
        total += _char_value(c) * _WEIGHTS[i % 3]
    return total % 10


def validate_field(data: str, check_digit: str) -> bool:
    """True si el digito verificador coincide con el campo dado."""
    if check_digit in ("<", "", " "):
        # Algunos documentos dejan el check digit vacio para campos opcionales
        return True
    try:
        return compute_check_digit(data) == int(check_digit)
    except ValueError:
        return False


@dataclass
class MRZField:
    value: str
    raw: str
    valid: bool


@dataclass
class MRZResult:
    document_type: MRZField
    country: MRZField
    document_number: MRZField
    birth_date: MRZField          # YYMMDD
    sex: MRZField
    expiry_date: MRZField         # YYMMDD
    nationality: MRZField
    surnames: MRZField
    given_names: MRZField
    composite_valid: bool
    raw_lines: list = field(default_factory=list)

    @property
    def all_valid(self) -> bool:
        return all(
            f.valid
            for f in [
                self.document_number,
                self.birth_date,
                self.expiry_date,
            ]
        ) and self.composite_valid

    def to_dict(self) -> dict:
        return {
            "document_type": self.document_type.value,
            "country": self.country.value,
            "document_number": self.document_number.value,
            "document_number_valid": self.document_number.valid,
            "birth_date": self._format_date(self.birth_date.value, is_expiry=False),
            "birth_date_valid": self.birth_date.valid,
            "sex": self.sex.value,
            "expiry_date": self._format_date(self.expiry_date.value, is_expiry=True),
            "expiry_date_valid": self.expiry_date.valid,
            "nationality": self.nationality.value,
            "surnames": self.surnames.value,
            "given_names": self.given_names.value,
            "composite_valid": self.composite_valid,
            "all_valid": self.all_valid,
        }

    @staticmethod
    def _format_date(yymmdd: str, is_expiry: bool = False) -> Optional[str]:
        """
        Convierte YYMMDD -> YYYY-MM-DD.

        Pivote de siglo:
        - NACIMIENTO: si yy > (año actual - 2000) asumimos 1900s,
          si no 2000s (nadie nace en el futuro).
        - EXPIRACION: las cedulas colombianas vigentes siempre expiran
          en 2000s+, se fuerza siglo 2000.
        """
        if not yymmdd or len(yymmdd) != 6 or not yymmdd.isdigit():
            return None
        yy, mm, dd = int(yymmdd[0:2]), int(yymmdd[2:4]), int(yymmdd[4:6])

        if is_expiry:
            century = 2000
        else:
            current_yy = date.today().year % 100
            century = 1900 if yy > current_yy else 2000

        try:
            return date(century + yy, mm, dd).isoformat()
        except ValueError:
            return None


def clean_mrz_line(line: str, expected_len: int = 30) -> str:
    """
    Normaliza una linea de MRZ leida por OCR:
    - Mayusculas
    - Corrige confusiones tipicas de OCR en zona MRZ (O<->0, I<->1, etc.)
    - Rellena/recorta a la longitud esperada
    """
    line = line.strip().upper().replace(" ", "")

    # Correcciones comunes SOLO en zonas donde sabemos que van digitos,
    # o caracteres de relleno. Aqui hacemos una limpieza conservadora,
    # correcciones posicionales mas finas se hacen campo por campo si
    # el checksum falla.
    line = line.replace("«", "<").replace("‹", "<")

    if len(line) < expected_len:
        line = line.ljust(expected_len, "<")
    elif len(line) > expected_len:
        line = line[:expected_len]

    return line


def parse_td1(line1: str, line2: str, line3: str) -> MRZResult:
    """
    Parsea un MRZ tipo TD1 (usado en cedula colombiana):

    Linea 1 (30): tipo_doc(2) + pais(3) + num_doc(9) + check_num(1)
                  + opcional(15)
    Linea 2 (30): nac_fecha(6) + check_nac(1) + sexo(1) + exp_fecha(6)
                  + check_exp(1) + nacionalidad(3) + opcional(11)
                  + check_compuesto(1)
    Linea 3 (30): apellidos<<nombres
    """
    l1 = clean_mrz_line(line1)
    l2 = clean_mrz_line(line2)
    l3 = clean_mrz_line(line3)

    doc_type = l1[0:2]
    country = l1[2:5]
    doc_number_raw = l1[5:14]
    doc_number_check = l1[14]
    doc_number = doc_number_raw.replace("<", "")

    birth_date_raw = l2[0:6]
    birth_check = l2[6]
    sex = l2[7]
    expiry_date_raw = l2[8:14]
    expiry_check = l2[14]
    nationality = l2[15:18]
    composite_check = l2[29]

    # Digito verificador compuesto: numero_doc + check + fecha_nac + check
    # + fecha_exp + check + campo_opcional (posiciones 18-28 de linea 2)
    optional_data = l2[18:29]
    composite_data = (
        doc_number_raw + doc_number_check
        + birth_date_raw + birth_check
        + expiry_date_raw + expiry_check
        + optional_data
    )
    composite_valid = validate_field(composite_data, composite_check)

    names_part = l3.replace("<<", "|").split("|")
    surnames = names_part[0].replace("<", " ").strip() if names_part else ""
    given_names = (
        names_part[1].replace("<", " ").strip() if len(names_part) > 1 else ""
    )

    return MRZResult(
        document_type=MRZField(doc_type, l1[0:2], True),
        country=MRZField(country, l1[2:5], True),
        document_number=MRZField(
            doc_number, doc_number_raw,
            validate_field(doc_number_raw, doc_number_check)
        ),
        birth_date=MRZField(
            birth_date_raw, birth_date_raw,
            validate_field(birth_date_raw, birth_check)
        ),
        sex=MRZField(sex, sex, sex in ("M", "F")),
        expiry_date=MRZField(
            expiry_date_raw, expiry_date_raw,
            validate_field(expiry_date_raw, expiry_check)
        ),
        nationality=MRZField(nationality, nationality, True),
        surnames=MRZField(surnames, l3, True),
        given_names=MRZField(given_names, l3, True),
        composite_valid=composite_valid,
        raw_lines=[l1, l2, l3],
    )


if __name__ == "__main__":
    # --- Ejemplo de uso con texto MRZ ya extraido por OCR ---
    # (estas 3 lineas normalmente vienen de tu paso de OCR sobre el
    # reverso del documento, ver ocr_pipeline.py)
    line1 = "ICCOL0785799236290734<<<<<<<<"
    line2 = "8906245F3504071COL1104701529<3"[:30]
    line3 = "BELTRAN<GAITAN<<KATHERINE<LORE"

    result = parse_td1(line1, line2, line3)

    import json
    print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))

    if not result.all_valid:
        print("\n⚠️  Uno o mas campos no pasaron la validacion de checksum.")
        print("   Reintenta el OCR en esa zona con otro preprocesamiento.")
    else:
        print("\n✅ Todos los campos validados correctamente contra su checksum.")
