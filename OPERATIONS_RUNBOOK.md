# BharatBridge v4.2 — Operational Runbook & Maintenance Guide

## 1. System Monitoring & Metrics Baseline
Operate and inspect the following metrics during live events:

| Metric | Target / SLA | Warning Threshold | Critical Action |
| :--- | :--- | :--- | :--- |
| **End-to-End Latency** | < 1,500 ms (P95) | > 1,200 ms | Fallback from Gemini to Azure/Google Translate |
| **WebSocket Connection Drop Rate** | < 0.1% | > 1.0% | Scale out Node.js app service instances |
| **TTS Synthesis Failure Rate** | < 0.01% | > 0.5% | Auto-failover to Azure Neural TTS or Google TTS |
| **Azure Storage Upload Health** | 100% | Any HTTP 5xx | Fallback to local file logging |

---

## 2. Troubleshooting Procedures

### Incident 1: High Translation Latency (> 2.0s)
1. **Symptom**: Captions take over 2 seconds to appear on listener screen.
2. **Diagnosis**: Inspect server terminal logs for `[TranslationOrchestrator] Primary provider (gemini) failed`.
3. **Mitigation**:
   - Check `GEMINI_API_KEY` quota limits.
   - Force fallback to Google Translate or Azure Translator in `.env`:
     ```env
     GEMINI_MODEL_TRANSLATION=gemini-2.5-flash
     ```

### Incident 2: Audio Synthesis Fails or Sounds Robotic
1. **Symptom**: Listener receives text captions but no voice playback, or fallback voice triggers.
2. **Diagnosis**: Check Smallest.ai API key status in server logs: `Smallest.ai HTTP 401/429`.
3. **Mitigation**: Verify `SMALLEST_API_KEY` in `.env`. System automatically switches to Azure Speech or Universal Google Neural TTS engine.

### Incident 3: Concurrent Listener Connection Spikes (> 1,000 Users)
1. **Symptom**: Node.js event loop lag increases.
2. **Mitigation**: Enable multi-process clustering or deploy multiple container replicas behind an NGINX or Azure Load Balancer with sticky sessions enabled for WebSocket connections.
