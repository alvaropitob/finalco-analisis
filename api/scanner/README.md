# Extractor de datos de cedula de ciudadania colombiana

## Instalacion

```bash
pip install opencv-python pytesseract passporteye pillow --break-system-packages
apt-get install tesseract-ocr   # si no lo tienes instalado
```

## Uso

```bash
python ocr_pipeline.py frente.jpg reverso.jpg
```

Devuelve un JSON con:
- `mrz`: datos leidos del reverso (numero, nombres, fechas, sexo,
  nacionalidad), cada campo con digito verificador viene con un flag
  `_valid` y hay auto-correccion de confusiones tipicas de OCR
  (O/0, I/1, S/5, B/8...) antes de darse por vencido.
- `front_fields`: datos del frente que NO estan en el MRZ (lugar de
  nacimiento, fecha de expedicion, grupo sanguineo, estatura). Estos
  NO tienen checksum, son "mejor esfuerzo" de OCR por region.
- `warnings`: lista de problemas detectados que ameritan revision manual.

## Arquitectura

| Archivo | Responsabilidad |
|---|---|
| `mrz_parser.py` | Parseo TD1 + validacion de checksum ICAO 9303 (sin dependencias de OCR) |
| `mrz_correction.py` | Auto-correccion de campos que fallan checksum, probando confusiones de caracteres tipicas de OCR |
| `preprocessing.py` | Utilidades OpenCV: deskew, binarizacion, upscale, recorte por region |
| `ocr_pipeline.py` | Orquesta todo: PassportEye para el MRZ + Tesseract por regiones para el frente |

## Por que MRZ primero

El reverso trae una zona MRZ (el bloque `ICCOL...`) con digitos
verificadores matematicos. Esto te da una fuente de verdad MUCHO mas
confiable que el frente: si el checksum no cuadra, sabes exactamente
que campo fallo, en vez de aceptar datos corruptos silenciosamente.
PassportEye ya resuelve la localizacion y OCR de esa zona de forma
robusta (mucho mejor que Tesseract "a mano" para esto en particular).

## Ajustar las regiones del frente a TUS fotos

`FRONT_REGIONS` en `ocr_pipeline.py` son fracciones (x1,y1,x2,y2) del
bounding box de la tarjeta (se detecta y recorta automaticamente con
`detect_card_bbox`). Fueron calibradas con una cedula de muestra; si
tus fotos vienen con angulo, resolucion o encuadre distinto, esperado
que necesites re-calibrar estos valores con 3-4 fotos reales tuyas.

Tip para calibrar rapido: corre esto sobre una foto tuya y mira las
fracciones (x/w, y/h) donde aparece cada campo:

```python
import cv2, pytesseract
img = cv2.imread("tu_frente.jpg")
h, w = img.shape[:2]
data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
for i, txt in enumerate(data["text"]):
    if txt.strip():
        x, y, ww, hh = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
        print(txt, f"xfrac=({x/w:.2f},{(x+ww)/w:.2f}) yfrac=({y/h:.2f},{(y+hh)/h:.2f})")
```

## Proximos pasos recomendados

1. Calibra `FRONT_REGIONS` con 3-5 fotos reales de tu dataset.
2. Si el volumen lo justifica, considera Google Document AI / Azure
   Form Recognizer para el frente en vez de Tesseract por region;
   toleran mucho mejor variaciones de angulo y luz.
3. Anade una limpieza de nombres (remover tokens sueltos de 1
   caracter que a veces mete el OCR entre apellidos, ej. la "X" en
   "BELTRAN X GAITAN").
4. Considera cachear/loguear los casos donde `all_valid=False` para
   revision manual, en vez de descartarlos.
