# VEED Fabric + Subtitles Talking Head Generator

A lightweight Hono server that accepts an image and audio upload, generates a talking-head video via `veed/fabric-1.0`, then adds burned-in subtitles with `veed/subtitles` using the `@fal-ai/client` SDK.

## Features

- `POST /generate` endpoint
- Upload an image + audio file
- Generate a talking-head MP4 from the image and voice audio
- Add stylized subtitles with a selectable preset and optional language hint
- Returns a final subtitled MP4 URL plus request IDs for both API steps

## Install

```bash
npm install
```

## Run locally

```bash
cp .env.example .env
# set FAL_KEY in .env
npm run dev
```

Open:

```bash
open http://localhost:3000
```

## Environment

Create a `.env` file with:

```bash
FAL_KEY=your_fal_ai_api_key_here
```

## API Endpoint

### `POST /generate`

Content-Type: `multipart/form-data`

Fields:

- `image` (file) — required
- `audio` (file) — required
- `resolution` (string) — optional, `720p` or `480p` (default: `720p`)
- `preset` (string) — optional subtitle preset (default: `glass`)
- `language` (string) — optional BCP-47 code for transcription accuracy

### Supported input types

- Image: `jpg`, `jpeg`, `png`, `webp`, `gif`, `avif`
- Audio: `mp3`, `ogg`, `wav`, `m4a`, `aac`

## How it works

1. Uploads `image` and `audio` to fal.ai storage via `fal.storage.upload()`
2. Calls `veed/fabric-1.0` to generate a talking-head video
3. Calls `veed/subtitles` to add burned-in captions
4. Returns the final subtitled MP4 URL

## Subtitle presets

Recommended default: `glass`

Dynamic presets (richer animation, higher cost):

`glass`, `whisper`, `glide`, `glide2`, `fusion`, `terminal`, `handwritten`

Basic presets:

`simple`, `plain`, `beans`, `corpo`, `boo`, `shadeplay`, `casper`, `capri`, `lowkey`, `vinta`, `diego`, `ali`, `slay`, `kitty`, `hustle`, `karl`, `sprout`, `flex`, `mint`, `rizz`, `vegas`

## Project structure

- `src/index.ts` — app entry and server startup
- `src/routes/generate.ts` — `/generate` route and request validation
- `src/services/fabric.ts` — Fabric API call
- `src/services/subtitles.ts` — Subtitles API call
- `src/utils/upload.ts` — file upload helper
- `src/utils/errors.ts` — error formatting helper

## Notes

- `FAL_KEY` is required for `/generate`
- The app serves static files from `public/`
- Use `npm run dev` for local development
