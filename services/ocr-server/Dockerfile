# Not exercised in the FoodDecode test runs (the service was tested by running server.py directly).
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
ENV HOST=0.0.0.0 PORT=8765
EXPOSE 8765
CMD ["python", "server.py"]
