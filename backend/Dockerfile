# ============================
# FastAPI Backend - TYB
# ============================

FROM python:3.12-slim

# Çalışma dizinini oluştur
WORKDIR /app

# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python paketleri için güvenli layer
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama dosyalarını container içine kopyala
COPY . /app

# SQLite dosyasını volume üzerinden dışarıda tutacağız.
# Dockerfile içine kopyalamıyoruz!

# Environment değişkenleri docker-compose ile verilecek
ENV PYTHONUNBUFFERED=1

# Gerekli port
EXPOSE 8001

# Uvicorn ile FastAPI server'ı başlat
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
