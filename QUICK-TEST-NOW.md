# 🚀 Quick Test - System Working Without MessageBox

**Status:** Ready to test NOW (no funds needed!)

---

## 🎯 What You Can Test Right Now

Your system is now **fully functional** for:
- ✅ Fleet tracking (50 vessels)
- ✅ Real-time UI updates via WebSocket
- ✅ BSV transaction building (when you have funds)

P2P messaging is gracefully disabled, but everything else works!

---

## 🧪 Test 1: Shipowner + UI (RECOMMENDED)

### Step 1: Start Shipowner

```bash
npm run start:shipowner
```

**Expected Output:**
```
═══════════════════════════════════════════════════
  HORMUZ SHIELD - SHIPOWNER AGENT
  BRC-100 P2P + BRC-29 Direct Payments
═══════════════════════════════════════════════════
Network: test
API Port: 3003
═══════════════════════════════════════════════════

[Shipowner] Initializing wallet...
[Shipowner] Wallet address: <your-address>
[Shipowner] Identity key: <your-key>...

[Shipowner] Initializing MessageBox (BRC-100) for P2P...
[Shipowner] ⚠️  MessageBox unavailable: <error message>
[Shipowner] Continuing with Direct Payments only (BRC-29)
[Shipowner] System will operate without P2P messaging

[Shipowner] Initializing fleet with 50 vessels...
[Shipowner] Fleet initialized with 50 vessels

[Shipowner] ⚠️  Coverage manager disabled (requires MessageBox)
[Shipowner] Fleet tracking and WebSocket broadcasting will still work

[Shipowner] Initializing WebSocket broadcaster for UI...
[Shipowner] WebSocket server ready on port 3103

[Shipowner] MessageBox P2P disabled - Fleet tracking and UI updates available

[Shipowner] 🚀 REST API listening on port 3003
[Shipowner] 📡 Ready for P2P messaging and fleet management
```

**✅ SUCCESS if you see:**
- Wallet initialized
- MessageBox warning (not error!)
- Fleet initialized with 50 vessels
- WebSocket ready on port 3103
- REST API listening on port 3003

### Step 2: Start UI (in another terminal)

```bash
npm run start:ui
```

**Expected Output:**
```
  VITE v8.0.8  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Step 3: Open Browser

Open: **http://localhost:5173**

**✅ SUCCESS if you see:**
- Map with Strait of Hormuz region
- 50 vessel markers on the map
- WebSocket status: "Connected" (green)
- Vessels updating position every ~20 seconds
- Risk zones highlighted (Hormuz, Bab el-Mandeb)

---

## 🧪 Test 2: Check API Endpoints

### Health Check
```bash
curl http://localhost:3003/health
```

**Expected:**
```json
{
  "status": "ok",
  "service": "shipowner",
  "identityKey": "<your-identity-key>",
  "address": "<your-bsv-address>"
}
```

### Fleet Status
```bash
curl http://localhost:3003/api/fleet
```

**Expected:**
```json
{
  "success": true,
  "vessels": [
    {
      "mmsi": 300000000,
      "name": "MV ATLAS",
      "type": "tanker",
      "position": {
        "lat": 26.123,
        "lon": 56.789
      },
      "hullValueUsd": 100000000
    },
    // ... 49 more vessels
  ]
}
```

### System Statistics
```bash
curl http://localhost:3003/api/stats
```

**Expected:**
```json
{
  "success": true,
  "stats": {
    "fleet": {
      "totalVessels": 50,
      "vessels": [300000000, 300000001, ...]
    },
    "coverage": {
      "unavailable": true
    },
    "claims": {
      "unavailable": true
    },
    "messageBoxAvailable": false
  }
}
```

**✅ SUCCESS if you see:**
- `messageBoxAvailable: false` (expected!)
- `totalVessels: 50`
- Coverage/claims show "unavailable" (expected without MessageBox)

---

## 🧪 Test 3: Start All Agents (Advanced)

```bash
# Terminal 1: Risk Oracle
npm run start:oracle

# Terminal 2: Insurer Pool
npm run start:insurer

# Terminal 3: Shipowner
npm run start:shipowner

# Terminal 4: Claims Verifier
npm run start:verifier

# Terminal 5: UI
npm run start:ui
```

**Expected for ALL agents:**
- ⚠️  MessageBox warning (not crash!)
- REST API starts successfully
- Core functionality available

---

## 🎯 What Each Warning Means

### Shipowner
```
⚠️  Coverage manager disabled (requires MessageBox)
Fleet tracking and WebSocket broadcasting will still work
```
**Meaning:**
- ✅ 50 vessels tracking works
- ✅ WebSocket to UI works
- ❌ Can't request insurance via P2P (needs MessageBox)

### Risk Oracle
```
⚠️  MessageBox unavailable
REST API and Direct Payments will still work
```
**Meaning:**
- ✅ AIS data processing works
- ✅ Risk calculations work
- ✅ REST API works
- ❌ Can't receive P2P risk queries (needs MessageBox)

### Insurer Pool
```
⚠️  MessageBox unavailable
Policy issuance via REST will still work
```
**Meaning:**
- ✅ Policy quotes via REST work
- ✅ Policy issuance via REST works
- ✅ Pool management works
- ❌ Can't handle P2P policy requests (needs MessageBox)

### Claims Verifier
```
⚠️  MessageBox unavailable
Manual verification via REST will still work
```
**Meaning:**
- ✅ Manual verification via REST works
- ✅ Verification engine works
- ❌ Can't handle P2P verification requests (needs MessageBox)

---

## ✅ Success Criteria

### Minimum (Shipowner + UI)
```
✅ Shipowner starts without crash
✅ WebSocket server on port 3103
✅ UI connects to WebSocket
✅ 50 vessels visible on map
✅ Vessels update every 20 seconds
```

### Full System (All Agents)
```
✅ All 4 agents start without crash
✅ Each shows MessageBox warning (not error!)
✅ All REST APIs responding
✅ UI displays real-time vessel data
✅ No TypeScript or runtime errors
```

---

## 🚨 Troubleshooting

### Problem: Port already in use

```bash
# Find process using port 3003
lsof -ti:3003

# Kill it
kill -9 $(lsof -ti:3003)
```

### Problem: UI not connecting to WebSocket

**Check:**
1. Shipowner is running (port 3003)
2. WebSocket server started (port 3103)
3. No firewall blocking localhost
4. Browser console for errors

**Fix:**
```bash
# Restart both
pkill -f "npm run start"
npm run start:shipowner  # Terminal 1
npm run start:ui         # Terminal 2
```

### Problem: Vessels not showing

**Check browser console:**
```javascript
// Should see WebSocket messages
WebSocket connected to ws://localhost:3103
Received vessels: 50 items
```

**If no messages:**
- Shipowner may not be broadcasting
- Check Shipowner console for errors
- Restart Shipowner

---

## 📊 What to Expect in UI

### Map View
- Center: Strait of Hormuz (~26°N, 56°E)
- 50 vessel markers distributed across:
  - Hormuz Strait
  - Persian Gulf
  - Gulf of Oman
  - Bab el-Mandeb
  - Red Sea approaches

### Real-Time Updates
- Vessels move along realistic routes
- Position updates every 20 seconds
- Risk colors change based on zone:
  - 🔴 Red: High risk (Hormuz, Bab el-Mandeb)
  - 🟡 Yellow: Medium risk (approaching zones)
  - 🟢 Green: Low risk (safe waters)

### WebSocket Status
- Top right corner: "Connected" (green)
- Shows connection to ws://localhost:3103
- Auto-reconnects if disconnected

### Transaction Feed
- Will be empty (no transactions without funds)
- Once funded: Shows real BSV transactions
- Displays: TXID, type, amount, timestamp

---

## 🎉 Success!

**If you see:**
1. ✅ Shipowner running with warnings (not errors)
2. ✅ UI displaying 50 vessels
3. ✅ WebSocket connected
4. ✅ Vessels updating position

**You have successfully verified:**
- System works without MessageBox
- Graceful degradation implemented
- Core functionality operational
- Ready for BSV transactions (when funded)

---

## 🔜 Next Steps

### When You Have BSV Funds

```bash
# 1. Generate wallets (if not done)
npm run generate-wallets

# 2. Fund wallets via faucet
# See: FONDEAR-AHORA.md

# 3. Start system
npm run start:all

# Expected:
# ✅ Everything from above
# ✅ PLUS: Real BSV transactions broadcast
# ✅ PLUS: Transactions visible in UI feed
# ✅ PLUS: TXIDs verifiable on blockchain
```

### When MessageBox Becomes Available

**No code changes needed!**

If MessageBox testnet hosts become available:
- System will automatically connect
- P2P features will activate
- Full functionality enabled

---

**Test now and verify the fix works! 🚀**

---

**Generated:** 17 de Abril, 2026
**Status:** ✅ READY TO TEST
