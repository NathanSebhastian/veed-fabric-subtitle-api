import { fal } from '@fal-ai/client';

export type SubtitlePreset =
  | 'glass'
  | 'whisper'
  | 'glide'
  | 'glide2'
  | 'fusion'
  | 'terminal'
  | 'handwritten'
  | 'simple'
  | 'plain'
  | 'beans'
  | 'corpo'
  | 'boo'
  | 'shadeplay'
  | 'casper'
  | 'capri'
  | 'lowkey'
  | 'vinta'
  | 'diego'
  | 'ali'
  | 'slay'
  | 'kitty'
  | 'hustle'
  | 'karl'
  | 'sprout'
  | 'flex'
  | 'mint'
  | 'rizz'
  | 'vegas';

export const subtitlePresets = [
  'glass',
  'whisper',
  'glide',
  'glide2',
  'fusion',
  'terminal',
  'handwritten',
  'simple',
  'plain',
  'beans',
  'corpo',
  'boo',
  'shadeplay',
  'casper',
  'capri',
  'lowkey',
  'vinta',
  'diego',
  'ali',
  'slay',
  'kitty',
  'hustle',
  'karl',
  'sprout',
  'flex',
  'mint',
  'rizz',
  'vegas',
] as const satisfies readonly SubtitlePreset[];

export const subtitlePresetSet = new Set<SubtitlePreset>(subtitlePresets);

export type SubtitlesResult = {
  videoUrl: string;
  requestId: string;
};

type SubtitlesResponse = {
  video?: {
    url?: string;
  };
};

export async function addSubtitles(
  videoUrl: string,
  preset: SubtitlePreset = 'glass',
  language?: string
): Promise<SubtitlesResult> {
  const input: Record<string, unknown> = { video_url: videoUrl, preset };
  if (language) {
    input.language = language;
  }

  const result = await fal.subscribe('veed/subtitles', {
    input,
    logs: false,
  });

  const data = result.data as SubtitlesResponse | undefined;
  if (!data?.video?.url) {
    throw new Error('Subtitles API returned no video URL');
  }

  return {
    videoUrl: data.video.url,
    requestId: result.requestId,
  };
}
