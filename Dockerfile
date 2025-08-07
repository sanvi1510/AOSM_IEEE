# Use an official Python 3.11 runtime as a base image
FROM python:3.11-slim

# --- Step 1: Install system software ---
# Update the package lists and install tesseract-ocr (for OCR) and
# poppler-utils (for converting PDF to images).
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# --- Step 2: Install Python packages ---
# Copy and install the Python packages from your requirements.txt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Step 3: Copy your application code ---
COPY . .

# --- Step 4: Define the run command ---
# Tell Render how to start your web server using Gunicorn
# (a production-ready server for Python apps)
CMD ["gunicorn", "--worker-tmp-dir", "/dev/shm", "app:app"]