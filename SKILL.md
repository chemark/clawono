---
name: grok-imagine-openclaw
description: Generate images with Grok Imagine (xAI Aurora) and send them to messaging channels via OpenClaw
allowed-tools: Bash(npm:*) Bash(npx:*) Bash(openclaw:*) Bash(curl:*) Read Write WebFetch
---

# Grok Imagine to OpenClaw

Generate AI images using xAI's Grok Imagine model and distribute them across messaging platforms (WhatsApp, Telegram, Discord, Slack, etc.) via OpenClaw.

## When to Use

- User wants to generate an image and share it across messaging channels
- User says "generate image and send to..." or "create art for..."
- User mentions Grok Imagine + any messaging platform
- User wants AI-generated content distributed to team/community channels

## Quick Reference

### Required Environment Variables

```bash
FAL_KEY=your_fal_api_key          # Get from https://fal.ai/dashboard/keys
OPENCLAW_GATEWAY_TOKEN=your_token  # From: openclaw doctor --generate-gateway-token
```

### Workflow

1. **Get user prompt** for image generation
2. **Generate image** via fal.ai Grok Imagine API
3. **Extract image URL** from response
4. **Send to OpenClaw** with target channel(s)

## Step-by-Step Instructions

### Step 1: Collect User Input

Ask the user for:
- **Image prompt**: What image should be generated?
- **Target channel(s)**: Where should it be sent? (e.g., `#general`, `@username`, channel ID)
- **Platform** (optional): Which platform? (discord, telegram, whatsapp, slack)

### Step 2: Generate Image with Grok Imagine

Use the fal.ai API to generate the image:

```bash
curl -X POST "https://fal.run/xai/grok-imagine-image" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "<USER_PROMPT>",
    "num_images": 1,
    "aspect_ratio": "1:1",
    "output_format": "jpeg"
  }'
```

**Response Format:**
```json
{
  "images": [
    {
      "url": "https://v3b.fal.media/files/...",
      "content_type": "image/jpeg",
      "width": 1024,
      "height": 1024
    }
  ],
  "revised_prompt": "Enhanced prompt text..."
}
```

### Step 3: Send Image via OpenClaw

Use the OpenClaw messaging API to send the generated image:

```bash
openclaw message send \
  --action send \
  --channel "<TARGET_CHANNEL>" \
  --message "<CAPTION_TEXT>" \
  --media "<IMAGE_URL>"
```

**Alternative: Direct API call**
```bash
curl -X POST "http://localhost:18789/message" \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send",
    "channel": "<TARGET_CHANNEL>",
    "message": "<CAPTION_TEXT>",
    "media": "<IMAGE_URL>"
  }'
```

## Complete Script Example

```bash
#!/bin/bash
# grok-imagine-send.sh

# Check required environment variables
if [ -z "$FAL_KEY" ]; then
  echo "Error: FAL_KEY environment variable not set"
  exit 1
fi

PROMPT="$1"
CHANNEL="$2"
CAPTION="${3:-Generated with Grok Imagine}"

if [ -z "$PROMPT" ] || [ -z "$CHANNEL" ]; then
  echo "Usage: $0 <prompt> <channel> [caption]"
  exit 1
fi

echo "Generating image with prompt: $PROMPT"

# Generate image
RESPONSE=$(curl -s -X POST "https://fal.run/xai/grok-imagine-image" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"$PROMPT\",
    \"num_images\": 1,
    \"aspect_ratio\": \"1:1\",
    \"output_format\": \"jpeg\"
  }")

# Extract image URL
IMAGE_URL=$(echo "$RESPONSE" | jq -r '.images[0].url')

if [ "$IMAGE_URL" == "null" ] || [ -z "$IMAGE_URL" ]; then
  echo "Error: Failed to generate image"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "Image generated: $IMAGE_URL"
echo "Sending to channel: $CHANNEL"

# Send via OpenClaw
openclaw message send \
  --action send \
  --channel "$CHANNEL" \
  --message "$CAPTION" \
  --media "$IMAGE_URL"

echo "Done!"
```

## Node.js/TypeScript Implementation

```typescript
import { fal } from "@fal-ai/client";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface GrokImagineResult {
  images: Array<{
    url: string;
    content_type: string;
    width: number;
    height: number;
  }>;
  revised_prompt?: string;
}

async function generateAndSend(
  prompt: string,
  channel: string,
  caption?: string
): Promise<string> {
  // Configure fal.ai client
  fal.config({
    credentials: process.env.FAL_KEY!
  });

  // Generate image with Grok Imagine
  console.log(`Generating image: "${prompt}"`);

  const result = await fal.subscribe("xai/grok-imagine-image", {
    input: {
      prompt,
      num_images: 1,
      aspect_ratio: "1:1",
      output_format: "jpeg"
    }
  }) as { data: GrokImagineResult };

  const imageUrl = result.data.images[0].url;
  console.log(`Image URL: ${imageUrl}`);

  // Send via OpenClaw
  const messageCaption = caption || `Generated with Grok Imagine`;

  await execAsync(
    `openclaw message send --action send --channel "${channel}" --message "${messageCaption}" --media "${imageUrl}"`
  );

  console.log(`Sent to ${channel}`);
  return imageUrl;
}

// Usage
generateAndSend(
  "A cyberpunk city at sunset with neon lights",
  "#art-gallery",
  "Check out this AI-generated art!"
);
```

## Supported Platforms

OpenClaw supports sending to:

| Platform | Channel Format | Example |
|----------|----------------|---------|
| Discord | `#channel-name` or channel ID | `#general`, `123456789` |
| Telegram | `@username` or chat ID | `@mychannel`, `-100123456` |
| WhatsApp | Phone number (JID format) | `1234567890@s.whatsapp.net` |
| Slack | `#channel-name` | `#random` |
| Signal | Phone number | `+1234567890` |
| MS Teams | Channel reference | (varies) |

## Grok Imagine Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | required | Image description |
| `num_images` | 1-4 | 1 | Number of images to generate |
| `aspect_ratio` | enum | "1:1" | 2:1, 16:9, 4:3, 1:1, 3:4, 9:16, etc. |
| `output_format` | enum | "jpeg" | jpeg, png, webp |

## Setup Requirements

### 1. Install fal.ai client (for Node.js usage)
```bash
npm install @fal-ai/client
```

### 2. Install OpenClaw CLI
```bash
npm install -g openclaw
```

### 3. Configure OpenClaw Gateway
```bash
openclaw config set gateway.mode=local
openclaw doctor --generate-gateway-token
```

### 4. Start OpenClaw Gateway
```bash
openclaw gateway start
```

## Error Handling

- **FAL_KEY missing**: Ensure the API key is set in environment
- **Image generation failed**: Check prompt content and API quota
- **OpenClaw send failed**: Verify gateway is running and channel exists
- **Rate limits**: fal.ai has rate limits; implement retry logic if needed

## Tips

1. **Better prompts**: Be descriptive - include style, lighting, mood
2. **Aspect ratios**: Use 16:9 for landscape, 9:16 for stories/reels
3. **Batch sending**: Generate once, send to multiple channels
4. **Scheduling**: Combine with OpenClaw scheduler for automated posts
