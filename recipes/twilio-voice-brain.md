---
id: twilio-voice-brain
name: Voice-to-Brain
version: 0.7.0
description: Phone calls create brain pages via Twilio + OpenAI Realtime + GBrain MCP. Callers talk, brain pages appear.
category: sense
requires: []
secrets:
  - name: TWILIO_ACCOUNT_SID
    description: Twilio account SID (starts with AC)
    where: https://console.twilio.com — Account Info section
  - name: TWILIO_AUTH_TOKEN
    description: Twilio auth token
    where: https://console.twilio.com — Account Info section
  - name: OPENAI_API_KEY
    description: OpenAI API key (needs Realtime API access)
    where: https://platform.openai.com/api-keys
health_checks:
  - "curl -sf https://api.twilio.com/2010-04-01 > /dev/null && echo 'Twilio: OK' || echo 'Twilio: FAIL'"
  - "curl -sf -H \"Authorization: Bearer $OPENAI_API_KEY\" https://api.openai.com/v1/models > /dev/null && echo 'OpenAI: OK' || echo 'OpenAI: FAIL'"
setup_time: 30 min
cost_estimate: "$15-20/mo (Twilio $2-3, OpenAI Realtime $6-10, hosting $5-10)"
---

# Voice-to-Brain: Phone Calls That Create Brain Pages

Call a phone number. Talk. A structured brain page appears with entity detection,
cross-references, and a summary posted to your messaging app.

## Architecture

```
Caller (phone)
  ↓ Twilio (WebSocket, g711_ulaw audio)
Voice Server (Node.js, your machine or cloud)
  ↓↑ OpenAI Realtime API (STT + LLM + TTS in one pipeline)
  ↓ Function calls during conversation
GBrain MCP (semantic search, page reads, page writes)
  ↓ Post-call
Brain page created (meetings/YYYY-MM-DD-call-{caller}.md)
Summary posted to messaging app (Telegram/Slack/Discord)
```

Key insight: audio is never transcoded. Twilio natively uses g711_ulaw, OpenAI
Realtime accepts g711_ulaw, so they plug directly together. Zero conversion overhead.

## Opinionated Defaults

These are production-tested defaults. Customize after setup.

**Caller routing (prompt-based, enforced server-side):**
- Owner: OTP challenge via secure channel, then full access (read + write + gateway)
- Trusted contacts: callback verification, scoped write access
- Known contacts (brain score >= 4): warm greeting by name, offer to transfer
- Unknown callers: screen, ask name + reason, take message

**Audio tuning:**
- VAD threshold: 0.95 (high confidence, fewer false triggers)
- Silence duration: 800ms (waits before considering speech done)
- Prefix padding: 400ms (captures start of utterance)
- Thinking sound: plays audio feedback during slow tool calls (brain search, gateway)

**Post-call pipeline (automatic on every call):**
1. Full transcript saved to brain (meetings/YYYY-MM-DD-call-{caller}.md)
2. Summary posted to messaging app with call details
3. Entity detection: people, companies, topics mentioned get brain page updates
4. Action items extracted and logged

**Security:**
- Twilio signature validation on `/voice` endpoint (X-Twilio-Signature header)
- Unauthenticated callers never see write tools
- All tool calls logged (timestamp, args, result, latency)
- Caller ID is NOT trusted for auth (OTP or callback required)

## Prerequisites

Before starting, you need:

1. **GBrain installed and configured** (`gbrain doctor` passes)
2. **Node.js 18+** (for the voice server)
3. **A Twilio account** (free trial works for testing)
4. **OpenAI API key** with Realtime API access
5. **A messaging bot** (Telegram, Slack, or Discord) for call summaries
6. **ngrok** (for local development) or a cloud server with HTTPS

## Setup Flow

The agent should execute these steps sequentially. Validate each credential
immediately after the user provides it.

### Step 1: Check Prerequisites

```bash
# Verify GBrain is configured
gbrain doctor --json

# Verify Node.js
node --version  # needs 18+

# Check if ngrok is installed
which ngrok || echo "ngrok not installed"
```

If GBrain doctor fails, run `gbrain init --supabase` first.
If ngrok is missing, install: `brew install ngrok` (Mac) or `snap install ngrok` (Linux).

### Step 2: Collect Credentials (Validate-as-you-go)

Ask the user for each credential. Test it immediately.

**Twilio SID + Auth Token:**
```bash
# Test Twilio credentials
curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json" \
  | grep -q '"status"' && echo "Twilio: connected!" || echo "Twilio: FAILED - check SID and auth token"
```

**OpenAI API Key:**
```bash
# Test OpenAI key
curl -sf -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models > /dev/null \
  && echo "OpenAI: connected!" || echo "OpenAI: FAILED - check API key"
```

**Messaging bot token** (ask which platform):
- Telegram: test with `curl https://api.telegram.org/bot$TOKEN/getMe`
- Slack: test webhook URL with a test message
- Discord: test webhook URL with a test message

### Step 3: Set Up ngrok Tunnel

```bash
# Authenticate ngrok (first time only)
ngrok config add-authtoken YOUR_TOKEN

# Start tunnel on voice server port
ngrok http 8765
```

Save the ngrok HTTPS URL. You'll need it for Twilio webhook config.

### Step 4: Create Voice Server

Create a directory for the voice server and set up the project:

```bash
mkdir -p voice-agent
cd voice-agent
npm init -y
npm install ws express
```

Create `server.mjs` with these components:

1. **HTTP server** on port 8765 with:
   - `POST /voice` — returns TwiML connecting to WebSocket
   - `GET /health` — returns `{ ok: true }`
   - Twilio signature validation on `/voice` endpoint

2. **WebSocket handler** at `/ws` that:
   - Accepts Twilio media stream
   - Opens second WebSocket to OpenAI Realtime API
   - Bridges audio bidirectionally (g711_ulaw, no conversion)
   - Handles function calls from OpenAI (tool execution)

3. **System prompt builder** that:
   - Takes caller phone number as input
   - Returns appropriate prompt based on caller routing rules
   - Defines available tools per auth level

4. **Tool executor** that:
   - Spawns GBrain MCP client (`gbrain serve` as child process)
   - Routes function calls: `search_brain` -> `gbrain query`
   - Routes: `lookup_person` -> `gbrain search` + `gbrain get`
   - Routes: `take_message` -> save + notify
   - Gates write tools behind authentication

5. **Post-call handler** that:
   - Saves full transcript to `brain/meetings/YYYY-MM-DD-call-{caller}.md`
   - Posts summary to messaging app
   - Triggers `gbrain sync` to index the new page

The voice server source is available in the GBrain repo examples (coming in a
future release). For now, reference the architecture above and the tool definitions
below.

### Step 5: Configure Twilio Webhook

```bash
# Purchase a phone number (or use existing)
# In Twilio console: Phone Numbers > Manage > Active Numbers
# Set Voice webhook to: https://YOUR-NGROK-URL.ngrok-free.app/voice
# Method: POST
```

Or via Twilio CLI:
```bash
twilio phone-numbers:update PHONE_SID \
  --voice-url https://YOUR-NGROK-URL.ngrok-free.app/voice \
  --voice-method POST
```

### Step 6: Start Voice Server

```bash
node server.mjs
```

Verify: `curl http://localhost:8765/health` should return `{"ok":true}`.

### Step 7: Smoke Test (Outbound Call)

The agent should call the USER to prove the system works. This is safer than
inbound (no spoofing risk) and more magical ("your phone is about to ring").

```bash
# Make an outbound test call via Twilio API
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Calls.json" \
  --data-urlencode "To=USER_PHONE_NUMBER" \
  --data-urlencode "From=TWILIO_PHONE_NUMBER" \
  --data-urlencode "Url=https://YOUR-NGROK-URL.ngrok-free.app/voice" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```

Tell the user: "Your phone is about to ring. Pick up and talk for 30 seconds.
When you hang up, check your messaging app for the call summary and your brain
for the new meeting page."

**Verify:**
1. Phone rings, user talks to voice agent
2. After hangup, messaging notification appears with summary
3. `gbrain search "call"` returns the new meeting page
4. Brain page has: transcript, entity mentions, action items

### Step 8: Set Up Inbound Calling

Now configure for ongoing inbound use:

1. Update Twilio webhook to point to your server (already done in Step 5)
2. Set up call forwarding from your primary number to Twilio (optional)
3. Configure caller routing rules in the system prompt
4. Add trusted phone numbers to the routing table

### Step 9: Watchdog (Auto-restart)

Set up a cron job or systemd service to keep the voice server running:

```bash
# Cron watchdog (every 2 minutes)
*/2 * * * * curl -sf http://localhost:8765/health > /dev/null || (cd /path/to/voice-agent && node server.mjs &)
```

If using ngrok, the watchdog should also check if the tunnel is alive and
update the Twilio webhook URL if the ngrok URL changed:

```bash
# Get current ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep -o 'https://.*')

# Update Twilio if URL changed
twilio phone-numbers:update PHONE_SID --voice-url "$NGROK_URL/voice"
```

### Step 10: Log Setup Completion

After successful smoke test, write a heartbeat event:

```bash
mkdir -p ~/.gbrain/integrations/twilio-voice-brain
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","event":"setup_complete","source_version":"0.7.0","status":"ok","details":{"phone":"TWILIO_NUMBER","deployment":"local+ngrok"}}' >> ~/.gbrain/integrations/twilio-voice-brain/heartbeat.jsonl
```

## Tool Definitions

### Read-Only Tools (All Callers)

| Tool | Purpose |
|------|---------|
| `lookup_person` | Search brain by phone or name, return compiled profile |
| `check_calendar` | Look ahead N hours for events + attendees |
| `search_brain` | Hybrid search across all brain pages |
| `take_message` | Save message + alert via messaging app |
| `transfer_call` | Forward call to owner's phone via Twilio API |

### Write Tools (Authenticated Only)

| Tool | Purpose |
|------|---------|
| `create_task` | Add task to ops/tasks.md |
| `update_brain_page` | Append timeline entry to a brain page |
| `send_message` | Post to messaging app topic |

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| Twilio phone number | $1-2/mo |
| Twilio voice minutes | $1-2/mo (100 min at $0.0085-0.015/min) |
| OpenAI Realtime API | $6-10/mo (100-200 min at ~$0.06/min) |
| ngrok (free tier) | $0 |
| **Total** | **$8-14/mo** |

For always-on deployment (Fly.io, Railway), add $5-10/mo for hosting.

## Troubleshooting

**Calls don't connect:**
- Check ngrok is running: `curl http://localhost:4040/api/tunnels`
- Check voice server is running: `curl http://localhost:8765/health`
- Check Twilio webhook URL matches ngrok URL
- Check Twilio console for error logs

**Voice agent doesn't respond:**
- Check OpenAI API key is valid and has Realtime access
- Check server logs for WebSocket connection errors
- Verify g711_ulaw codec is supported (it is on all OpenAI Realtime models)

**Brain pages not created after call:**
- Check GBrain is running: `gbrain doctor`
- Check post-call handler is executing (check server logs)
- Run `gbrain sync` manually to trigger indexing

**ngrok URL keeps changing:**
- Free ngrok URLs change on restart
- Set up the watchdog (Step 9) to auto-update Twilio webhook
- Or upgrade to ngrok paid tier for a static URL ($8/mo)
