import { Hono } from 'hono';
import { generateTalkingVideo, type FabricResolution } from '../services/fabric.js';
import {
  addSubtitles,
  subtitlePresetSet,
  type SubtitlePreset,
} from '../services/subtitles.js';
import { logStepError, toErrorMessage } from '../utils/errors.js';
import { uploadToFal } from '../utils/upload.js';

const router = new Hono();

const imageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const audioTypes = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/aac',
  'audio/aacp',
  'audio/m4a',
  'audio/x-m4a',
]);

function isFile(value: unknown): value is File {
  return value instanceof File && value.size > 0;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function validateFile(file: File, allowedTypes: Set<string>, label: string): string | null {
  if (!allowedTypes.has(file.type)) {
    return `${label} has an unsupported file type`;
  }

  return null;
}

router.post('/generate', async (c) => {
  const body = await c.req.parseBody();

  const imageFile = body.image;
  const audioFile = body.audio;

  if (!isFile(imageFile) || !isFile(audioFile)) {
    return c.json(
      {
        status: 'error',
        message: "Both 'image' and 'audio' fields are required",
        step: 'upload',
      },
      400
    );
  }

  const imageError = validateFile(imageFile, imageTypes, 'Image');
  const audioError = validateFile(audioFile, audioTypes, 'Audio');
  if (imageError || audioError) {
    return c.json(
      {
        status: 'error',
        message: imageError ?? audioError,
        step: 'upload',
      },
      400
    );
  }

  let imageUrl: string;
  let audioUrl: string;
  try {
    [imageUrl, audioUrl] = await Promise.all([uploadToFal(imageFile), uploadToFal(audioFile)]);
  } catch (error) {
    logStepError('upload', error);
    return c.json({ status: 'error', message: toErrorMessage(error), step: 'upload' }, 400);
  }

  const resolution: FabricResolution = stringField(body.resolution) === '480p' ? '480p' : '720p';

  let fabricVideoUrl: string;
  let fabricRequestId: string;
  try {
    const fabric = await generateTalkingVideo(imageUrl, audioUrl, resolution);
    fabricVideoUrl = fabric.videoUrl;
    fabricRequestId = fabric.requestId;
  } catch (error) {
    logStepError('fabric', error);
    return c.json({ status: 'error', message: toErrorMessage(error), step: 'fabric' }, 500);
  }

  const presetValue = stringField(body.preset);
  const preset: SubtitlePreset =
    presetValue && subtitlePresetSet.has(presetValue as SubtitlePreset)
      ? (presetValue as SubtitlePreset)
      : 'glass';
  const language = stringField(body.language);

  try {
    const subtitled = await addSubtitles(fabricVideoUrl, preset, language);
    return c.json({
      status: 'success',
      video_url: subtitled.videoUrl,
      fabric_request_id: fabricRequestId,
      subtitles_request_id: subtitled.requestId,
    });
  } catch (error) {
    logStepError('subtitles', error);
    return c.json({ status: 'error', message: toErrorMessage(error), step: 'subtitles' }, 500);
  }
});

export default router;
