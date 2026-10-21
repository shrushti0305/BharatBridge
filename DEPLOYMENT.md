# BharatBridge v4.2 — Deployment & Infrastructure Specification

## 1. Environment Requirements
- **Node.js**: v18.x or v20.x LTS
- **TypeScript**: v5.x
- **Container Runtime**: Docker / Containerd / Kubernetes (GKE or Azure Container Apps)
- **Memory**: Minimum 2 GB RAM per instance (4 GB recommended for 1,000 concurrent listeners)
- **CPU**: Minimum 2 vCPUs per instance

---

## 2. Environment Variables Configuration (`.env`)

```env
# Server Runtime
NODE_ENV=production
PORT=3000

# Google Gemini API (NMT Translation & Event Summarization)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL_TRANSLATION=gemini-2.5-flash
GEMINI_MODEL_SUMMARY=gemini-2.5-flash

# Smallest.ai Waves API (High-Fidelity Indian Regional TTS)
SMALLEST_API_KEY=sk_your_smallest_key_here
SMALLEST_VOICE_ID=radhika

# Azure Cognitive Services (Fallback Translator & Speech Services)
AZURE_TRANSLATOR_KEY=your_azure_translator_key
AZURE_TRANSLATOR_REGION=centralindia
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=centralindia

# Azure Storage (Dual JSON/CSV Caption Persistence)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_CONTAINER_NAME=ai-audio
```

---

## 3. Docker Containerization Setup

### Dockerfile (`Dockerfile`)
```dockerfile
# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
```

---

## 4. Production Build & Execution

### Local Build & Start
```bash
# 1. Install dependencies
npm install

# 2. Verify TypeScript types
npx tsc --noEmit

# 3. Build Vite frontend bundle
npm run build

# 4. Launch production server
NODE_ENV=production npx tsx server.ts
```

---

## 5. Health Checks & Probes
- **HTTP Liveness Probe**: `GET http://localhost:3000/api/health`
- **Expected Payload**:
  ```json
  {
    "status": "ok",
    "mode": "production",
    "azureStorageConfigured": true
  }
  ```
