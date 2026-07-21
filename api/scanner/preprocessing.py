"""
preprocessing.py

Funciones de preprocesamiento de imagen con OpenCV para mejorar la
precision del OCR, tanto para la zona MRZ (reverso) como para los
campos del frente.
"""

import cv2
import numpy as np


def load_image(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"No se pudo leer la imagen: {path}")
    return img


def deskew(img: np.ndarray) -> np.ndarray:
    """Corrige inclinacion de la imagen basandose en el contenido de texto."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    gray = cv2.bitwise_not(gray)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

    coords = np.column_stack(np.where(thresh > 0))
    if coords.shape[0] == 0:
        return img
    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle

    (h, w) = img.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )


def to_binary(img: np.ndarray) -> np.ndarray:
    """Escala de grises + umbral adaptativo Otsu. Ideal para texto MRZ."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def upscale(img: np.ndarray, factor: float = 2.0) -> np.ndarray:
    """El OCR mejora notablemente si el texto tiene suficiente resolucion."""
    h, w = img.shape[:2]
    return cv2.resize(
        img, (int(w * factor), int(h * factor)), interpolation=cv2.INTER_CUBIC
    )


def prepare_for_ocr(img: np.ndarray) -> np.ndarray:
    """Pipeline completo: deskew -> upscale -> binarizar."""
    img = deskew(img)
    img = upscale(img, 2.0)
    img = to_binary(img)
    return img


def crop_region(img: np.ndarray, box: tuple) -> np.ndarray:
    """
    Recorta una region de la imagen.
    box: (x_min, y_min, x_max, y_max) como FRACCIONES de ancho/alto (0-1),
    para que la region sea independiente de la resolucion de la foto.
    """
    h, w = img.shape[:2]
    x1, y1, x2, y2 = box
    return img[int(y1 * h):int(y2 * h), int(x1 * w):int(x2 * w)]


def find_mrz_region(img: np.ndarray) -> np.ndarray:
    """
    Localiza automaticamente la zona MRZ en el reverso usando morfologia:
    el MRZ es una banda de texto denso y uniforme cerca de la parte
    inferior de la imagen. Estrategia:
      1. Gradiente morfologico para resaltar texto
      2. Cierre horizontal para fusionar caracteres en lineas
      3. Buscar el contorno mas ancho en el tercio inferior de la imagen
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    h, w = gray.shape

    # Nos enfocamos en el tercio inferior, donde SIEMPRE esta el MRZ
    # en el formato de cedula colombiana
    lower_third = gray[int(h * 0.55):, :]

    blackhat = cv2.morphologyEx(
        lower_third, cv2.MORPH_BLACKHAT,
        cv2.getStructuringElement(cv2.MORPH_RECT, (25, 7))
    )
    grad = cv2.Sobel(blackhat, cv2.CV_32F, dx=1, dy=0, ksize=-1)
    grad = np.absolute(grad)
    grad = ((grad - grad.min()) / (grad.max() - grad.min() + 1e-6) * 255).astype("uint8")
    grad = cv2.morphologyEx(
        grad, cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (25, 7))
    )
    thresh = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    thresh = cv2.morphologyEx(
        thresh, cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (25, 15))
    )

    contours, _ = cv2.findContours(
        thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        # Fallback: devuelve el tercio inferior completo
        return img[int(h * 0.55):, :]

    largest = max(contours, key=cv2.contourArea)
    x, y, cw, ch = cv2.boundingRect(largest)

    # Margen de seguridad alrededor del bounding box detectado
    pad_x, pad_y = int(cw * 0.05), int(ch * 0.3)
    y_offset = int(h * 0.55)
    x1 = max(0, x - pad_x)
    y1 = max(0, y_offset + y - pad_y)
    x2 = min(w, x + cw + pad_x)
    y2 = min(h, y_offset + y + ch + pad_y)

    return img[y1:y2, x1:x2]
