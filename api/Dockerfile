# Backend Dockerfile - CréditoIA
FROM python:3.11-slim

# Instalar dependencias de sistema (Tesseract y Poppler)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    libmagic1 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar requerimientos e instalar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código
COPY . .

# Exponer puerto para FastAPI
EXPOSE 8000

# Comando para ejecutar la API
CMD ["uvicorn", "index:app", "--host", "0.0.0.0", "--port", "8000"]
