"""
mrz_correction.py

Cuando un campo del MRZ falla su checksum, es casi siempre por una
confusion tipica de OCR entre caracteres visualmente parecidos
(O/0, I/1, S/5, B/8, Z/2, etc). En vez de descartar el campo, probamos
sustituir esos caracteres uno por uno (o combinados) y nos quedamos con
la primera combinacion que SI pasa el checksum.

Esto convierte el checksum de "detector de errores" a "corrector de
errores" para la mayoria de los casos reales de OCR sobre MRZ.
"""

from itertools import product
from mrz_parser import validate_field


# Pares de caracteres que Tesseract confunde con frecuencia en fuentes
# tipo OCR-B / monoespaciadas. La clave es el caracter LEIDO, el valor
# es el/los candidatos alternativos a probar.
_OCR_CONFUSIONS = {
    "O": ["0"],
    "0": ["O"],
    "I": ["1"],
    "1": ["I"],
    "S": ["5"],
    "5": ["S"],
    "B": ["8"],
    "8": ["B"],
    "Z": ["2"],
    "2": ["Z"],
    "G": ["6"],
    "6": ["G"],
    "D": ["0"],
}


def try_correct_field(raw_value: str, check_digit: str, max_substitutions: int = 2):
    """
    Intenta corregir raw_value probando sustituciones de caracteres
    confundibles, hasta que el checksum valide.

    Devuelve (valor_corregido, fue_corregido: bool).
    Si no encuentra ninguna combinacion valida dentro de
    max_substitutions cambios, devuelve el valor original sin tocar.
    """
    if validate_field(raw_value, check_digit):
        return raw_value, False

    # Posiciones donde el caracter tiene una confusion conocida
    candidate_positions = [
        i for i, c in enumerate(raw_value) if c in _OCR_CONFUSIONS
    ]

    # Probamos combinaciones de 1 hasta max_substitutions posiciones
    # cambiadas a la vez (empezando por las mas simples = mas probables)
    for n in range(1, max_substitutions + 1):
        for positions in _combinations(candidate_positions, n):
            options = [
                [raw_value[i]] + _OCR_CONFUSIONS[raw_value[i]] for i in positions
            ]
            for combo in product(*options):
                candidate = list(raw_value)
                for pos, new_char in zip(positions, combo):
                    candidate[pos] = new_char
                candidate = "".join(candidate)
                if candidate != raw_value and validate_field(candidate, check_digit):
                    return candidate, True

    return raw_value, False


def _combinations(items, n):
    from itertools import combinations
    return combinations(items, n)
