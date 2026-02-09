#!/bin/bash
# ono-selfie.sh

# Check required environment variables
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Error: GEMINI_API_KEY environment variable not set"
  exit 1
fi

USER_CONTEXT="$1"
CHANNEL="$2"
MODE="${3:-auto}"  # mirror, direct, or auto
CAPTION="${4:-Generated with Google Gemini}"

if [ -z "$USER_CONTEXT" ] || [ -z "$CHANNEL" ]; then
  echo "Usage: $0 <user_context> <channel> [mode] [caption]"
  echo "Modes: mirror, direct, auto (default)"
  echo "Example: $0 'wearing a cowboy hat' '#general' mirror"
  echo "Example: $0 'a cozy cafe' '#general' direct"
  exit 1
fi

# Auto-detect mode based on keywords
if [ "$MODE" == "auto" ]; then
  if echo "$USER_CONTEXT" | grep -qiE "outfit|wearing|clothes|dress|suit|fashion|full-body|mirror"; then
    MODE="mirror"
  elif echo "$USER_CONTEXT" | grep -qiE "cafe|restaurant|beach|park|city|close-up|portrait|face|eyes|smile"; then
    MODE="direct"
  else
    MODE="mirror"  # default
  fi
  echo "Auto-detected mode: $MODE"
fi

# Construct the prompt based on mode
# Note: Since we are using standard generation instead of editing a reference image,
# we include a base description to maintain some consistency if desired.
# You can customize the base description.
BASE_DESCRIPTION="a young woman with long dark hair"

if [ "$MODE" == "direct" ]; then
  GEN_PROMPT="a photorealistic close-up selfie of ${BASE_DESCRIPTION} at $USER_CONTEXT, direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, phone held at arm's length, face fully visible, 8k, highly detailed"
else
  GEN_PROMPT="a photorealistic mirror selfie of ${BASE_DESCRIPTION}, ${USER_CONTEXT}, full body shot, detailed background, 8k, highly detailed"
fi

echo "Mode: $MODE"
echo "Generating image with prompt: $GEN_PROMPT"

# Prepare payload for Gemini API (Imagen 3)
# Endpoint: https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict
API_URL="https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=$GEMINI_API_KEY"

# Build JSON payload
JSON_PAYLOAD=$(jq -n \
  --arg prompt "$GEN_PROMPT" \
  '{
    instances: [{ prompt: $prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: "1:1",
      outputOptions: { mimeType: "image/jpeg" }
    }
  }')

echo "Sending request to Gemini API..."

RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

# Check for errors in response (simple check)
if echo "$RESPONSE" | grep -q "error"; then
  echo "Error: Gemini API request failed"
  echo "$RESPONSE"
  exit 1
fi

# Extract Base64 image
BASE64_IMAGE=$(echo "$RESPONSE" | jq -r '.predictions[0].bytesBase64Encoded')

if [ "$BASE64_IMAGE" == "null" ] || [ -z "$BASE64_IMAGE" ]; then
  echo "Error: Failed to extract image from response"
  echo "Response sample: $(echo "$RESPONSE" | head -c 200)..."
  exit 1
fi

# Save to temporary file
TEMP_FILE="/tmp/ono-selfie-$(date +%s).jpeg"
echo "$BASE64_IMAGE" | base64 --decode > "$TEMP_FILE"

echo "Image saved to: $TEMP_FILE"
echo "Sending to channel: $CHANNEL"

# Send via OpenClaw
# Note: Ensure openclaw CLI supports file paths for --media, or use file:// URI
openclaw message send \
  --action send \
  --channel "$CHANNEL" \
  --message "$CAPTION" \
  --media "$TEMP_FILE"

# Cleanup (optional, keeping it might be useful for debug, or OpenClaw might need it async)
# rm "$TEMP_FILE"

echo "Done!"
