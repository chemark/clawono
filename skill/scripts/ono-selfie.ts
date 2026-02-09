/**
 * Ono Selfie - OpenClaw Integration
 *
 * Generates images using Google Gemini (Imagen 3)
 * and sends them to messaging channels via OpenClaw.
 *
 * Usage:
 *   npx ts-node ono-selfie.ts "<prompt>" "<channel>" ["<caption>"]
 *
 * Environment variables:
 *   GEMINI_API_KEY - Your Google Gemini API key
 *   OPENCLAW_GATEWAY_URL - OpenClaw gateway URL (default: http://localhost:18789)
 *   OPENCLAW_GATEWAY_TOKEN - Gateway auth token (optional)
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const execAsync = promisify(exec);

// Types
interface OnoImageInput {
  prompt: string;
  num_images?: number;
  aspect_ratio?: AspectRatio;
  output_format?: OutputFormat;
}

interface OnoImageResponse {
  predictions: string[]; // Base64 strings or URLs depending on API
}

interface OpenClawMessage {
  action: "send";
  channel: string;
  message: string;
  media?: string; // URL or base64
}

type AspectRatio =
  | "1:1"
  | "16:9"
  | "4:3"
  | "3:4"
  | "9:16";

type OutputFormat = "jpeg" | "png";

interface GenerateAndSendOptions {
  prompt: string;
  channel: string;
  caption?: string;
  aspectRatio?: AspectRatio;
  outputFormat?: OutputFormat;
  useOpenClawCLI?: boolean;
}

interface Result {
  success: boolean;
  imageUrl?: string;
  channel: string;
  prompt: string;
}

/**
 * Generate image using Google Gemini (Imagen 3)
 */
async function generateImage(
  input: OnoImageInput
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable not set. Get your key from https://aistudio.google.com/app/apikey"
    );
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`;

  // Construct payload for Imagen 3
  const payload = {
    instances: [
      {
        prompt: input.prompt,
      },
    ],
    parameters: {
      sampleCount: input.num_images || 1,
      aspectRatio: input.aspect_ratio || "1:1",
      outputOptions: {
        mimeType: input.output_format === "png" ? "image/png" : "image/jpeg"
      }
    },
  };

  console.log(`[INFO] Calling Gemini API (Imagen 3)...`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.predictions || data.predictions.length === 0) {
    throw new Error("No predictions returned from Gemini API");
  }

  // Gemini API returns base64 string for Imagen
  const base64Image = data.predictions[0].bytesBase64Encoded;
  const mimeType = data.predictions[0].mimeType || (input.output_format === "png" ? "image/png" : "image/jpeg");

  // Since OpenClaw might expect a URL or we need to host it, 
  // currently we will return a data URL.
  // Note: OpenClaw CLI might need a file path or URL. 
  // If base64 is too long for CLI args, we might need to save to a temp file.

  return `data:${mimeType};base64,${base64Image}`;
}

/**
 * Send image via OpenClaw
 */
async function sendViaOpenClaw(
  message: OpenClawMessage,
  useCLI: boolean = true
): Promise<void> {
  const mediaContent = message.media;

  // If media is base64 data URL, we might need to save it to a file first for the CLI to handle it robustly,
  // or pass it directly if the CLI supports it. 
  // Assuming CLI supports file paths better for long strings.
  let mediaArg = mediaContent;

  if (mediaContent && mediaContent.startsWith("data:")) {
    // Save to temp file
    const base64Data = mediaContent.replace(/^data:image\/\w+;base64,/, "");
    const ext = mediaContent.substring(mediaContent.indexOf("/") + 1, mediaContent.indexOf(";"));
    const tempFile = `/tmp/ono-selfie-${Date.now()}.${ext}`;
    fs.writeFileSync(tempFile, base64Data, 'base64');
    mediaArg = tempFile;
    console.log(`[INFO] Saved generated image to temporary file: ${tempFile}`);
  }

  if (useCLI) {
    // Use OpenClaw CLI
    // We wrap message in quotes to handle spaces
    const cmd = `openclaw message send --action send --channel "${message.channel}" --message "${message.message}" --media "${mediaArg}"`;
    await execAsync(cmd);
    return;
  }

  // Direct API call
  const gatewayUrl =
    process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (gatewayToken) {
    headers["Authorization"] = `Bearer ${gatewayToken}`;
  }

  const response = await fetch(`${gatewayUrl}/message`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...message,
      media: mediaContent // Send full base64/URL to API
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenClaw send failed: ${error}`);
  }
}

/**
 * Main function: Generate image and send to channel
 */
async function generateAndSend(options: GenerateAndSendOptions): Promise<Result> {
  const {
    prompt,
    channel,
    caption = "Generated with Google Gemini",
    aspectRatio = "1:1",
    outputFormat = "jpeg",
    useOpenClawCLI = true,
  } = options;

  console.log(`[INFO] Generating image with Ono (Gemini)...`);
  console.log(`[INFO] Prompt: ${prompt}`);

  // Generate image
  try {
    const imageUrl = await generateImage({
      prompt,
      num_images: 1,
      aspect_ratio: aspectRatio,
      output_format: outputFormat,
    });

    console.log(`[INFO] Image generated successfully.`);

    // Send via OpenClaw
    console.log(`[INFO] Sending to channel: ${channel}`);

    await sendViaOpenClaw(
      {
        action: "send",
        channel,
        message: caption,
        media: imageUrl,
      },
      useOpenClawCLI
    );

    console.log(`[INFO] Done! Image sent to ${channel}`);

    return {
      success: true,
      imageUrl: imageUrl.substring(0, 50) + "...", // Truncate for log
      channel,
      prompt,
    };
  } catch (error) {
    console.error(`[ERROR] Generation or sending failed:`, error);
    throw error;
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage: npx ts-node ono-selfie.ts <prompt> <channel> [caption] [aspect_ratio] [output_format]

Arguments:
  prompt        - Image description (required)
  channel       - Target channel (required) e.g., #general, @user
  caption       - Message caption (default: 'Generated with Google Gemini')
  aspect_ratio  - Image ratio (default: 1:1) Options: 1:1, 16:9, 4:3, 3:4, 9:16
  output_format - Image format (default: jpeg) Options: jpeg, png

Environment:
  GEMINI_API_KEY - Your Google Gemini API key (required)

Example:
  GEMINI_API_KEY=your_key npx ts-node ono-selfie.ts "A cyberpunk city" "#art" "Check this out!"
`);
    process.exit(1);
  }

  const [prompt, channel, caption, aspectRatio, outputFormat] = args;

  try {
    const result = await generateAndSend({
      prompt,
      channel,
      caption,
      aspectRatio: aspectRatio as AspectRatio,
      outputFormat: outputFormat as OutputFormat,
    });

    console.log("\n--- Result ---");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}`);
    process.exit(1);
  }
}

// Export for module use
export {
  generateImage,
  sendViaOpenClaw,
  generateAndSend,
  OnoImageInput,
  OnoImageResponse,
  OpenClawMessage,
  GenerateAndSendOptions,
  Result,
};

// Run if executed directly
if (require.main === module) {
  main();
}
