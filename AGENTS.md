# AGENTS.md — Talking Head Video Generator (VEED Fabric + Subtitles on HonoJS)

## Project Overview

A HonoJS server that accepts an image and audio file upload, generates a talking head video via the **VEED Fabric 1.0 API** (fal.ai), then pipes the result through the **VEED Subtitles API** (fal.ai) to burn in polished, styled captions. The final output is a download URL to the subtitled MP4.

---

## Tech Stack

| Layer        | Choice                        |
|--------------|-------------------------------|
| Server       | HonoJS (Node.js runtime)      |
| File upload  | HonoJS built-in `body()`      |
| API client   | `@fal-ai/client`              |
| File hosting | fal.ai storage (auto-upload)  |
| Auth         | `FAL_KEY` env variable        |

---

## Environment Variables

```
FAL_KEY=your_fal_ai_api_key_here
PORT=3000                          # optional, defaults to 3000
```

**Never commit `FAL_KEY` to version control.** Use a `.env` file locally and inject it via your host's secret manager in production.

---

## Project Structure

```
/
├── src/
│   ├── index.ts          # Hono app entry, route registration
│   ├── routes/
│   │   └── generate.ts   # POST /generate — main workflow route
│   ├── services/
│   │   ├── fabric.ts     # Calls veed/fabric-1.0 (image → talking video)
│   │   └── subtitles.ts  # Calls veed/subtitles (video → subtitled video)
│   └── utils/
│       └── upload.ts     # Uploads File/Blob to fal.ai storage, returns URL
├── .env
├── package.json
└── AGENTS.md
```

---

## API Endpoint

### `POST /generate`

**Content-Type:** `multipart/form-data`

| Field       | Type   | Required | Notes                                         |
|-------------|--------|----------|-----------------------------------------------|
| `image`     | File   | ✅       | JPG, PNG, WebP, GIF, or AVIF                  |
| `audio`     | File   | ✅       | MP3, OGG, WAV, M4A, or AAC                    |
| `resolution`| string | ❌       | `"720p"` (default) or `"480p"`                |
| `preset`    | string | ❌       | Subtitle preset (default: `"glass"`)          |
| `language`  | string | ❌       | BCP-47 code e.g. `"en-US"` — improves accuracy|

**Success response (200):**
```json
{
  "status": "success",
  "video_url": "https://v3.fal.media/files/.../output.mp4",
  "fabric_request_id": "...",
  "subtitles_request_id": "..."
}
```

**Error response (4xx / 5xx):**
```json
{
  "status": "error",
  "message": "Human-readable description of the failure",
  "step": "upload | fabric | subtitles"
}
```

---

## Workflow (Step-by-Step)

```
Client
  │
  │  POST /generate  (image + audio + options)
  ▼
[1] Upload image & audio to fal.ai storage
      └─ fal.storage.upload(imageFile)  → image_url
      └─ fal.storage.upload(audioFile)  → audio_url
  │
  ▼
[2] Call veed/fabric-1.0
      Input:  { image_url, audio_url, resolution }
      Output: { video.url }  ← talking head MP4 (no subtitles)
  │
  ▼
[3] Call veed/subtitles
      Input:  { video_url: <step 2 output>, preset, language? }
      Output: { video.url }  ← final subtitled MP4
  │
  ▼
Return { status, video_url, request IDs }
```

Both fal.ai calls are **long-running** (video generation takes time). Use `fal.subscribe()` which polls until completion. Do **not** use `fal.queue.submit()` without a polling loop unless you implement webhooks.

---

## Service Implementation Details

### `src/utils/upload.ts`

```typescript
import { fal } from "@fal-ai/client";

export async function uploadToFal(file: File): Promise<string> {
  // fal client auto-uploads File/Blob objects and returns a CDN URL
  const url = await fal.storage.upload(file);
  return url;
}
```

### `src/services/fabric.ts`

```typescript
import { fal } from "@fal-ai/client";

export type FabricResult = {
  videoUrl: string;
  requestId: string;
};

export async function generateTalkingVideo(
  imageUrl: string,
  audioUrl: string,
  resolution: "720p" | "480p" = "720p"
): Promise<FabricResult> {
  const result = await fal.subscribe("veed/fabric-1.0", {
    input: { image_url: imageUrl, audio_url: audioUrl, resolution },
    logs: false,
  });

  if (!result.data?.video?.url) {
    throw new Error("Fabric API returned no video URL");
  }

  return {
    videoUrl: result.data.video.url,
    requestId: result.requestId,
  };
}
```

**Input schema (veed/fabric-1.0):**
| Field        | Type   | Required | Values              |
|--------------|--------|----------|---------------------|
| `image_url`  | string | ✅       | Publicly accessible URL or fal CDN URL |
| `audio_url`  | string | ✅       | Publicly accessible URL or fal CDN URL |
| `resolution` | enum   | ✅       | `"720p"` \| `"480p"` |

**Output schema:**
```json
{
  "video": {
    "url": "https://...",
    "file_name": "output.mp4",
    "file_size": 1198529,
    "content_type": "application/octet-stream"
  }
}
```

**Pricing:** $0.15/second at 720p · $0.08/second at 480p

---

### `src/services/subtitles.ts`

```typescript
import { fal } from "@fal-ai/client";

export type SubtitlesResult = {
  videoUrl: string;
  requestId: string;
};

export type SubtitlePreset =
  | "glass" | "whisper" | "glide" | "glide2" | "fusion" | "terminal" | "handwritten" // dynamic (2x cost)
  | "simple" | "plain" | "beans" | "corpo" | "boo" | "shadeplay" | "casper"           // basic (1x cost)
  | "capri" | "lowkey" | "vinta" | "diego" | "ali" | "slay" | "kitty"
  | "hustle" | "karl" | "sprout" | "flex" | "mint" | "rizz" | "vegas";

export async function addSubtitles(
  videoUrl: string,
  preset: SubtitlePreset = "glass",
  language?: string
): Promise<SubtitlesResult> {
  const input: Record<string, unknown> = { video_url: videoUrl, preset };
  if (language) input.language = language;

  const result = await fal.subscribe("veed/subtitles", {
    input,
    logs: false,
  });

  if (!result.data?.video?.url) {
    throw new Error("Subtitles API returned no video URL");
  }

  return {
    videoUrl: result.data.video.url,
    requestId: result.requestId,
  };
}
```

**Input schema (veed/subtitles):**
| Field          | Type   | Required | Notes                                       |
|----------------|--------|----------|---------------------------------------------|
| `video_url`    | string | ✅       | URL of the raw video (from Fabric output)   |
| `preset`       | enum   | ✅       | See preset list above                       |
| `language`     | enum   | ❌       | BCP-47 code; improves transcription accuracy|
| `srt_file_url` | string | ❌       | Provide your own SRT to skip transcription  |
| `srt_content`  | string | ❌       | Raw SRT text; alternative to `srt_file_url` |
| `customization`| object | ❌       | Override position, shadow, fonts, colors    |

**Output schema:**
```json
{
  "video": {
    "url": "https://...",
    "content_type": "video/mp4"
  }
}
```

**Pricing:** $0.10/minute base · Dynamic presets: 2x · Resolution >1080p: 2x · Minimum charge: 1 minute

---

### `src/routes/generate.ts`

```typescript
import { Hono } from "hono";
import { uploadToFal } from "../utils/upload";
import { generateTalkingVideo } from "../services/fabric";
import { addSubtitles, SubtitlePreset } from "../services/subtitles";

const router = new Hono();

router.post("/generate", async (c) => {
  const body = await c.req.parseBody();

  const imageFile = body["image"] as File | undefined;
  const audioFile = body["audio"] as File | undefined;

  if (!imageFile || !audioFile) {
    return c.json({ status: "error", message: "Both 'image' and 'audio' fields are required", step: "upload" }, 400);
  }

  // Step 1: Upload files
  let imageUrl: string;
  let audioUrl: string;
  try {
    [imageUrl, audioUrl] = await Promise.all([
      uploadToFal(imageFile),
      uploadToFal(audioFile),
    ]);
  } catch (err) {
    return c.json({ status: "error", message: String(err), step: "upload" }, 500);
  }

  // Step 2: Fabric — generate talking head video
  const resolution = (body["resolution"] as string) === "480p" ? "480p" : "720p";
  let fabricVideoUrl: string;
  let fabricRequestId: string;
  try {
    const fabric = await generateTalkingVideo(imageUrl, audioUrl, resolution);
    fabricVideoUrl = fabric.videoUrl;
    fabricRequestId = fabric.requestId;
  } catch (err) {
    return c.json({ status: "error", message: String(err), step: "fabric" }, 500);
  }

  // Step 3: Subtitles — burn in captions
  const preset = (body["preset"] as SubtitlePreset) || "glass";
  const language = body["language"] as string | undefined;
  try {
    const subtitled = await addSubtitles(fabricVideoUrl, preset, language);
    return c.json({
      status: "success",
      video_url: subtitled.videoUrl,
      fabric_request_id: fabricRequestId,
      subtitles_request_id: subtitled.requestId,
    });
  } catch (err) {
    return c.json({ status: "error", message: String(err), step: "subtitles" }, 500);
  }
});

export default router;
```

---

### `src/index.ts`

```typescript
import { Hono } from "hono";
import { fal } from "@fal-ai/client";
import generateRouter from "./routes/generate";

// Configure fal client (reads FAL_KEY from env automatically)
fal.config({
  credentials: process.env.FAL_KEY,
});

const app = new Hono();
app.route("/", generateRouter);

export default app;
```

---

## package.json (minimum)

```json
{
  "scripts": {
    "dev": "node --watch src/index.ts",
    "start": "node src/index.ts"
  },
  "dependencies": {
    "hono": "^4.x",
    "@fal-ai/client": "^1.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x"
  }
}
```

---

## Subtitle Preset Reference

### Dynamic presets (2× cost multiplier — richer animations)
`glass` · `whisper` · `glide` · `glide2` · `fusion` · `terminal` · `handwritten`

**Recommended default:** `glass` — high contrast, clean, works well for talking head content.

### Basic presets (1× cost — lightweight, predictable)
`simple` · `plain` · `beans` · `corpo` · `boo` · `shadeplay` · `casper` · `capri` · `lowkey` · `vinta` · `diego` · `ali` · `slay` · `kitty` · `hustle` · `karl` · `sprout` · `flex` · `mint` · `rizz` · `vegas`

---

## Error Handling Rules

- Wrap **every** fal API call in try/catch. Surface the error with a `step` field so callers know which stage failed.
- If `fal.subscribe()` resolves but `result.data.video.url` is missing, treat it as an error — do not pass `undefined` to the next step.
- fal API errors include an HTTP status and message in the thrown error object. Log the full error server-side; return only the message to the client.
- File upload failures (oversized, wrong type, network) should return `400` not `500` where identifiable.

---

## Known Constraints

- **Fabric pricing** scales with output duration (not a flat rate). A 60-second audio clip at 720p ≈ $9.00. Warn users accordingly.
- **Subtitles minimum charge** is 1 minute even for short videos.
- **fal.ai CDN URLs** are time-limited. Do not store them as permanent links — download and re-host if persistence is needed.
- **File size:** fal recommends uploading via `fal.storage.upload()` for files >1MB rather than base64 data URIs.
- **Concurrency:** Both APIs are async queue-based. Parallel independent jobs are fine; do not submit Subtitles until Fabric has completed.
- **Supported image formats:** JPG, JPEG, PNG, WebP, GIF, AVIF
- **Supported audio formats:** MP3, OGG, WAV, M4A, AAC
- **Max subtitle video duration:** ≤1080p → 2 hours; >1080p → 1 hour

---

## Testing the Endpoint

```bash
curl -X POST http://localhost:3000/generate \
  -F "image=@/path/to/photo.jpg" \
  -F "audio=@/path/to/voiceover.mp3" \
  -F "resolution=720p" \
  -F "preset=glass" \
  -F "language=en-US"
```

Expected: JSON with `status: "success"` and a `video_url` pointing to the final subtitled MP4.