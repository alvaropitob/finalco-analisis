"""
ocr_pipeline.py

Pipeline end-to-end para extraer datos de una cedula de ciudadania
colombiana a partir de fotos del frente y del reverso.

Uso:
    python ocr_pipeline.py frente.jpg reverso.jpg

Estrategia:
  1. Reverso -> PassportEye localiza y lee el MRZ automaticamente
     (mucho mas robusto que Tesseract "a mano" para esta zona).
  2. Cada campo con digito verificador se valida con mrz_parser; si
     falla, mrz_correction intenta reparar confusiones tipicas de OCR
     (O/0, I/1, S/5, B/8...) hasta que el checksum de OK.
  3. Frente -> OCR por regiones fijas para datos que NO estan en el
     MRZ (lugar de nacimiento, fecha de expedicion, grupo sanguineo).
  4. Se devuelve un dict con los datos + un flag de confianza por
     campo, para que tu aplicacion decida si necesita revision manual.
"""

import sys
import re
import json
import warnings

import pytesseract
import cv2
from passporteye import read_mrz

from preprocessing import load_image, crop_region, to_binary, upscale
from mrz_parser import validate_field, MRZResult
from mrz_correction import try_correct_field

warnings.filterwarnings("ignore")  # silencia warnings de skimage/passporteye


# --- Regiones del FRENTE como fracciones (x1, y1, x2, y2) del ancho/alto ---
# Calibradas empiricamente sobre el BOUNDING BOX de la tarjeta (no sobre
# la foto completa, que puede traer margenes variables). Por eso el
# pipeline primero recorta la tarjeta con detect_card_bbox() antes de
# aplicar estas fracciones. Ajusta si tu fuente de imagenes difiere.
FRONT_REGIONS = {
    "apellidos": (0.37, 0.185, 0.65, 0.235),
    "nombres": (0.37, 0.30, 0.68, 0.35),
    "nacionalidad": (0.37, 0.415, 0.50, 0.49),
    "estatura": (0.55, 0.395, 0.65, 0.475),
    "fecha_nacimiento": (0.37, 0.505, 0.56, 0.56),
    "grupo_sanguineo": (0.55, 0.485, 0.62, 0.56),
    "lugar_nacimiento": (0.37, 0.565, 0.65, 0.645),
    "fecha_lugar_expedicion": (0.37, 0.685, 0.65, 0.775),
    "fecha_expiracion": (0.37, 0.82, 0.56, 0.91),
}


def detect_card_bbox(img):
    """
    Detecta el rectangulo de la tarjeta dentro de la foto, asumiendo
    fondo mas claro/uniforme alrededor. Devuelve (x, y, w, h).
    Si falla, devuelve la imagen completa como fallback.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 235, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        h, w = img.shape[:2]
        return 0, 0, w, h
    largest = max(contours, key=cv2.contourArea)
    return cv2.boundingRect(largest)


def read_mrz_data(reverso_path: str) -> dict:
    """
    Lee el MRZ con PassportEye y aplica auto-correccion sobre los
    campos que fallen el checksum.
    """
    mrz = read_mrz(reverso_path)
    if mrz is None:
        raise RuntimeError(
            "PassportEye no pudo localizar una zona MRZ en la imagen. "
            "Verifica que el reverso este bien enfocado y sin recortes."
        )

    data = mrz.to_dict()
    lines = data["raw_text"].split("\n")
    if len(lines) < 3:
        raise RuntimeError("MRZ incompleto: se esperaban 3 lineas.")
    line1, line2, line3 = [l.ljust(30, "<")[:30] for l in lines[:3]]

    corrections = {}

    # --- Numero de documento (linea 1, posiciones 5-14, check en 14) ---
    doc_number_raw = line1[5:14]
    doc_check = line1[14]
    doc_number_fixed, was_fixed = try_correct_field(doc_number_raw, doc_check)
    if was_fixed:
        corrections["document_number"] = {
            "original": doc_number_raw, "corrected": doc_number_fixed
        }
    doc_number_valid = validate_field(doc_number_fixed, doc_check)

    # --- Fecha de nacimiento (linea 2, posiciones 0-6, check en 6) ---
    birth_raw = line2[0:6]
    birth_check = line2[6]
    birth_fixed, birth_was_fixed = try_correct_field(birth_raw, birth_check)
    if birth_was_fixed:
        corrections["birth_date"] = {"original": birth_raw, "corrected": birth_fixed}
    birth_valid = validate_field(birth_fixed, birth_check)

    # --- Fecha de expiracion (linea 2, posiciones 8-14, check en 14) ---
    expiry_raw = line2[8:14]
    expiry_check = line2[14]
    expiry_fixed, expiry_was_fixed = try_correct_field(expiry_raw, expiry_check)
    if expiry_was_fixed:
        corrections["expiry_date"] = {"original": expiry_raw, "corrected": expiry_fixed}
    expiry_valid = validate_field(expiry_fixed, expiry_check)

    result = {
        "document_type": data.get("type"),
        "country": data.get("country"),
        "document_number": doc_number_fixed.replace("<", ""),
        "document_number_valid": doc_number_valid,
        "birth_date": MRZResult._format_date(birth_fixed, is_expiry=False),
        "birth_date_valid": birth_valid,
        "sex": data.get("sex"),
        "expiry_date": MRZResult._format_date(expiry_fixed, is_expiry=True),
        "expiry_date_valid": expiry_valid,
        "nationality": data.get("nationality"),
        "surnames": data.get("surname", "").replace("<", " ").strip(),
        "given_names": data.get("names", "").replace("<", " ").strip(),
        "composite_valid": bool(data.get("valid_composite")),
        "passporteye_confidence_score": data.get("valid_score"),
        "corrections_applied": corrections,
        "raw_lines": [line1, line2, line3],
    }
    result["all_valid"] = (
        doc_number_valid and birth_valid and expiry_valid
        and result["composite_valid"]
    )
    return result


def ocr_front_field(img, field_key: str) -> str:
    box = FRONT_REGIONS[field_key]
    crop = crop_region(img, box)
    crop = upscale(crop, 4.0)
    # padding para no cortar ascendentes/descendentes de letras en el borde
    crop = cv2.copyMakeBorder(
        crop, 15, 15, 15, 15, cv2.BORDER_CONSTANT, value=(255, 255, 255)
    )
    crop = to_binary(crop)
    text = pytesseract.image_to_string(crop, config="--psm 7")
    return re.sub(r"\s+", " ", text).strip()


def extract_front_fields(frente_path: str) -> dict:
    img = load_image(frente_path)
    x, y, w, h = detect_card_bbox(img)
    card = img[y:y + h, x:x + w]

    data = {}
    for field_key in FRONT_REGIONS:
        try:
            data[field_key] = ocr_front_field(card, field_key)
        except Exception:
            data[field_key] = None
    return data


def extract_cedula(frente_path: str, reverso_path: str) -> dict:
    result = {"mrz": None, "front_fields": None, "warnings": []}

    try:
        result["mrz"] = read_mrz_data(reverso_path)
        if not result["mrz"]["all_valid"]:
            result["warnings"].append(
                "Uno o mas campos del MRZ no pasaron checksum incluso "
                "tras auto-correccion; revisar manualmente."
            )
    except Exception as e:
        result["warnings"].append(f"Fallo lectura de MRZ: {e}")

    try:
        result["front_fields"] = extract_front_fields(frente_path)
    except Exception as e:
        result["warnings"].append(f"Fallo OCR del frente: {e}")

    return result


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python ocr_pipeline.py <frente.jpg> <reverso.jpg>")
        sys.exit(1)

    frente_path, reverso_path = sys.argv[1], sys.argv[2]
    data = extract_cedula(frente_path, reverso_path)
    print(json.dumps(data, indent=2, ensure_ascii=False))
