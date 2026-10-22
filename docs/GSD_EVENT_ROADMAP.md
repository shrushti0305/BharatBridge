# GSD Roadmap: BharatBridge 3-Day Live Event Production Plan

**Target**: Supervised 3-Day Live Event (10-12 hours/day), 1 room with 10 speakers/panelists + up to 1,000 listeners, 22+ languages, captions + translated audio, 2 operators.

---

## Phase I: Security, Token Architecture & Host Session Resilience (Steps 3–5)

### Step 3: WebSocket Limits & Origin Keyed by Token
- **Objective**: Move all connection throttling and rate limiting from IP-based to token-based (solving hotspot and venue NAT sharing).
- **Deliverables**:
  - Token-bucket limiter keyed on `sessionToken` / `hostToken`.
  - Origin allowlist fail-closed in production; missing-Origin permitted for native/mobile clients.
  - Verification: Automated test with 50 distinct tokens from a single IP simulating a venue NAT/hotspot.

### Step 4: Host Reconnect & Immutable Role Reclaim
- **Objective**: Host must retain host privileges across page refreshes (F5), mobile network toggles, token renewals, and server instance failover.
- **Deliverables**:
  - `hostToken` persistence in client `sessionStorage` with graceful re-auth handshake.
  - Server-side atomic host lock: on reconnect with valid `hostToken`, server re-associates socket without demotion to listener.
  - Multi-tab detection and clean handoff.
  - Verification: Simulated network drop & reconnect test verifying host status preservation.

### Step 5: Panel Mode (Up to 10 Speakers, STT Gated by Mic State)
- **Objective**: Support up to 10 active panelists, streaming audio to STT **only** when unmuted.
- **Deliverables**:
  - Server panelist registry tracking mute/unmute state per speaker socket.
  - Client mic gate: raw audio packets are dropped locally when muted; server drops any unexpected audio frames from muted panelists.
  - Concurrent speaker display metadata (active speaker indicator sent to all listeners).
  - Verification: Automated multi-speaker test verifying STT stream is invoked only for unmuted panelists.

---

## Phase II: Broadcast Fan-Out, Audio Pipeline & Probes (Steps 6–8)

### Step 6: Per-Language Fan-Out, Backpressure & Memory Leak Protection
- **Objective**: Single translation & TTS synthesis per utterance per language, shared by all listeners.
- **Deliverables**:
  - Language channel subscriber registry with isolated buffers.
  - Slow listener detection & eviction: drop or disconnect slow clients when `ws.bufferedAmount` crosses 256 KB.
  - Bounded in-memory queues for all rooms and caches.
  - Verification: 100-listener mock broadcast showing single translation call counter and slow-listener eviction.

### Step 7: Server Metrics Aggregator & Synthetic Probe Listeners
- **Objective**: Low-overhead server-side metrics push (every 1–2s) and end-to-end synthetic probe bots.
- **Deliverables**:
  - Server telemetry aggregation (latency, listener counts, queue depth, error rates) pushed to operators.
  - 1 headless probe bot per language verifying receipt of captions and audio within SLA.
  - Verification: Probe failure turns telemetry row red within 15 seconds.

### Step 8: Audio Delivery Architecture Benchmark
- **Objective**: Compare (a) audio over WebSocket vs (b) short Opus segments on CDN/Blob vs (c) Azure Web PubSub.
- **Deliverables**:
  - Benchmark report measuring bandwidth, latency, and egress cost at 1,000 listeners.
  - Recommended implementation (Option b default: 2–4s Opus segments at 16–24 kbps).
  - Projected egress GB and daily cost analysis.

---

## Phase III: Mobile Hardening, Cluster Fan-Out & Load Verification (Steps 9–11)

### Step 9: Mobile Network Resilience & Long-Lived Auth
- **Objective**: Seamless recovery on mobile devices (hotspots, 4G/5G handoffs, lock-screen).
- **Deliverables**:
  - Jittered exponential backoff with sequence-number resume (no audio replay).
  - Background SSE / HTTP long-polling fallback for captions.
  - Silent token refresh before expiry.
  - Verification: Network switch and latency injection simulation test.

### Step 10: Multi-Instance Cluster, Redis Fan-Out & Failover
- **Objective**: Run 2+ server instances behind load balancer; instance death does not terminate room.
- **Deliverables**:
  - Redis Pub/Sub backplane for cross-instance message routing.
  - Room state externalization in Redis / Cosmos DB.
  - Verification: Kill instance 1 mid-broadcast; instance 2 continues broadcasting without dropped captions.

### Step 11: Scaled Load Tests (50 $\rightarrow$ 200 $\rightarrow$ 1,000 Listeners)
- **Objective**: Prove cluster handles 10 speakers + 1,000 listeners across 11+ languages.
- **Deliverables**:
  - Stage 1 Gate: 50 listeners load test.
  - Stage 2 Gate: 200 listeners load test.
  - Stage 3 Gate: 1,000 listeners load test with simulated mobile jitter and packet loss.
  - Verification: p95 latency under target thresholds; zero memory leaks.

---

## Phase IV: Client Experience & Operator Control (Steps 12–15)

### Step 12: Graceful Degradation UX & Battery/Data Controls
- **Objective**: Clear user messaging on failure and low-resource devices.
- **Deliverables**:
  - Tap-to-play audio gate (iOS/Android autoplay policy compliance).
  - Degradation ladder: Audio+Captions $\rightarrow$ Captions-Only $\rightarrow$ Reconnecting banner.
  - Data-saver mode (disables audio streaming, retains text) and low-power mode.
  - Virtualized caption history list.

### Step 13: Operator Admin Dashboard & Real-Time Controls
- **Objective**: Single-page operations panel for 2 operators.
- **Deliverables**:
  - Per-language health table, speaker status, infrastructure gauges, and quota meters.
  - Controls: Mute/remove panelist, toggle language, broadcast banner, emergency captions-only kill switch.
  - Firebase custom claim auth (Viewer vs Operator) with full audit logging.

### Step 14: Client Bundle Audit & Key Vault Hardening
- **Objective**: Ensure zero credentials or internal tokens leak into client bundles.
- **Deliverables**:
  - Remove all `VITE_` secret variables.
  - Static AST scan verifying bundle contains no API keys or Cosmos/Azure SDKs.

### Step 15: Voice Pipeline Refinement (Text Chunking & Neural Voices)
- **Objective**: Long speech synthesis without truncation.
- **Deliverables**:
  - SSML and sentence-boundary text chunking for long utterances.
  - Explicit error handling for unsupported TTS locales.

---

## Phase V: Governance, Operations & Verification (Steps 16–23)

### Step 16: Codebase Deletion & Legacy Cleanup
- Dedicated cleanup branch removing legacy endpoints, dead code, and unused dependencies.

### Step 17: Production Deployment Assets & Dockerization
- Production Dockerfile, Kubernetes/App Service manifests, readiness/liveness probes, graceful SIGTERM shutdown.

### Step 18: Privacy, Participant Consent & Retention Policies
- Participant consent disclaimers, automatic 7-day TTL cleanup on Cosmos documents, daily transcript export.

### Step 19: Session Rollover & Two-Operator Runbook
- Start-of-day checklist, shift handoff protocol, operator role division (Quality vs Infra), escalation matrix.

### Step 20: CodeRabbit Security & Architecture Review
- Full PR review and resolution of all findings.

### Step 21: Comprehensive Pre-Event Re-Audit
- Static and dynamic vulnerability audit on the final release commit.

### Step 22: Endurance Soak Testing (12-Hour & 36-Hour)
- 12-hour continuous test followed by 36-hour soak: verify flat memory curves, zero handle leaks, and event-loop health.

### Step 23: Human & Native Speaker Validation
- Live native-speaker sign-off for Hindi, Gujarati, Marathi.
- Physical handset testing on mobile networks and venue Wi-Fi on Day -1.
