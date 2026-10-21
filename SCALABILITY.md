# BharatBridge v4.2 — Scalability & High-Concurrency Architecture

## 1. Core Principle: "Generate Once → Distribute Many"
BharatBridge optimizes cloud resource consumption and API token costs by avoiding redundant NMT translations or TTS audio generations for identical target languages.

```
                  ┌──────────────┐
                  │ Speaker Mic  │
                  └──────┬───────┘
                         │ 1 Audio Stream
                         ▼
             ┌──────────────────────┐
             │ Node.js Server Proxy │
             └───────────┬──────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Hindi Room   │ │ Marathi Room │ │ Tamil Room   │
│ (300 Users)  │ │ (400 Users)  │ │ (300 Users)  │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ▼ 1 Broadcast    ▼ 1 Broadcast    ▼ 1 Broadcast
 [ 300 Listeners] [ 400 Listeners] [ 300 Listeners]
```

### Resource Savings Comparison (1,000 Listeners in 3 Language Groups)
| Architecture Approach | NMT API Calls | TTS Synthesis Calls | Outbound WS Connections |
| :--- | :--- | :--- | :--- |
| **Naive Per-User Model** | 1,000 / sentence | 1,000 / sentence | 1,000 |
| **BharatBridge Fan-Out** | **3 / sentence** | **3 / sentence** | **1,000** |
| **Efficiency Gain** | **99.7% Reduction** | **99.7% Reduction** | **100% Broadcast** |

---

## 2. Multi-Panelist Concurrent Model (Up to 10 Speakers)
- **Speaker Attribution**: Every transcript frame includes `speakerId` (`speaker-01` through `speaker-10`).
- **Concurrent Audio Streams**: Up to 10 speaker mic inputs are demuxed at the WebSocket layer.
- **Microphone Arbitration**: Client-side mic locking prevents overlapping acoustic feedback while allowing seamless panelist handoff.

---

## 3. Network Bandwidth & Memory Capacity Sizing

### Bandwidth Sizing (1,000 Concurrent Listeners)
- **Caption Text Payload**: ~0.5 KB per sentence
- **TTS Audio Payload**: ~25 KB per synthesized sentence (MP3 @ 24 kbps)
- **Outbound Audio Traffic**: `3 language streams × 25 KB = 75 KB` per sentence
- **Total Network Egress**: `1,000 listeners × 25 KB = 25 MB` per broadcast sentence (~200 Mbps peak output across cluster).

### Memory Sizing
- **WebSocket Buffer**: ~15 KB per connected client
- **1,000 Connected WebSocket Sockets**: `1,000 × 15 KB = 15 MB RAM`
- **Total Node.js Memory Footprint**: **< 250 MB RAM** under peak 1,000 listener load.
