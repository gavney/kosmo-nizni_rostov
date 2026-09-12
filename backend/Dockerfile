FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY backend /app/backend
COPY fixtures /app/fixtures
ENV PYTHONPATH=/app/backend
ENV SIM_SLOTS=1
ENV SIM_WAIT_S=50
ENV MAX_CACHED_SIMS=6
ENV MAX_FRAME_CACHE=48
EXPOSE 8000
# 2 workers × 1 sim slot ≈ 2 concurrent full-day jobs on a 4-vCPU box.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--limit-concurrency", "40"]
