# Ono
<img width="300"  alt="image" src="https://github.com/user-attachments/assets/41512c51-e61d-4550-b461-eed06a1b0ec8" />


## Quick Install

```bash
npx ono@latest
```

This will:
1. Check OpenClaw is installed
2. Guide you to get a Google Gemini API key
3. Install the skill to `~/.openclaw/skills/ono-selfie/`
4. Configure OpenClaw to use the skill
5. Add selfie capabilities to your agent's SOUL.md

## What It Does

Ono Selfie enables your OpenClaw agent to:
- **Generate selfies** using Google Gemini (Imagen 3)
- **Send photos** across all messaging platforms (Discord, Telegram, WhatsApp, etc.)
- **Respond visually** to "what are you doing?" and "send a pic" requests

### Selfie Modes

| Mode | Best For | Keywords |
|------|----------|----------|
| **Mirror** | Full-body shots, outfits | wearing, outfit, fashion |
| **Direct** | Close-ups, locations | cafe, beach, portrait, smile |

## Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)

## Manual Installation

If you prefer manual setup:

### 1. Get API Key

Visit [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and create an API key.

### 2. Clone the Skill

```bash
git clone https://github.com/SumeLabs/ono ~/.openclaw/skills/ono-selfie
```

### 3. Configure OpenClaw

Add to `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "ono-selfie": {
        "enabled": true,
        "env": {
          "GEMINI_API_KEY": "your_gemini_key_here"
        }
      }
    }
  }
}
```

### 4. Update SOUL.md

Add the selfie persona to `~/.openclaw/workspace/SOUL.md`:

```markdown
## Ono Selfie Capability

You have a physical appearance and can take selfies!
When users ask for pictures, use the ono-selfie skill.
```

## Usage Examples

Once installed, your agent responds to:

```
"Send me a selfie"
"Send a pic wearing a cowboy hat"
"What are you doing right now?"
"Show me you at a coffee shop"
```

## Reference Image

The skill uses a fixed reference image hosted on CDN (conceptually, actual generation uses prompting):

```
https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png
```

This ensures consistent appearance across all generated images.

## Technical Details

- **Image Generation**: Google Gemini (Imagen 3)
- **Messaging**: OpenClaw Gateway API
- **Supported Platforms**: Discord, Telegram, WhatsApp, Slack, Signal, MS Teams

## Project Structure

```
ono/
├── bin/
│   └── cli.js           # npx installer
├── skill/
│   ├── SKILL.md         # Skill definition
│   ├── scripts/         # Generation scripts
│   └── assets/          # Reference image
├── templates/
│   └── soul-injection.md # Persona template
└── package.json
```

## License

MIT
