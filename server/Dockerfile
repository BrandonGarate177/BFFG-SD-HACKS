# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base

# Python 3.12 rather than 3.13: pandas/pyarrow wheels are more reliably
# available, and nothing here needs 3.13.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first so the layer caches across code changes.
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# The predictions frame is read-only and only 15 MB — ship it in the image
# rather than fetching at boot, so there is no startup dependency on S3.
COPY data/predictions.parquet        /app/data/predictions.parquet
COPY data/predictions_meta.json      /app/data/predictions_meta.json
COPY server/                         /app/server/

WORKDIR /app/server

EXPOSE 8000

# One worker on purpose. Each worker loads its own copy of the frame
# (~554 MB resident once queried), so two workers would need >1 GB and OOM
# on a 1 GB task. Scale by adding tasks, never by adding workers here.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
