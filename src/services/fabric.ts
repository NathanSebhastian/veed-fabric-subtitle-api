import { fal } from '@fal-ai/client';

export type FabricResolution = '720p' | '480p';

export type FabricResult = {
  videoUrl: string;
  requestId: string;
};

type FabricResponse = {
  video?: {
    url?: string;
  };
};

export async function generateTalkingVideo(
  imageUrl: string,
  audioUrl: string,
  resolution: FabricResolution = '720p'
): Promise<FabricResult> {
  const result = await fal.subscribe('veed/fabric-1.0', {
    input: { image_url: imageUrl, audio_url: audioUrl, resolution },
    logs: false,
  });

  const data = result.data as FabricResponse | undefined;
  if (!data?.video?.url) {
    throw new Error('Fabric API returned no video URL');
  }

  return {
    videoUrl: data.video.url,
    requestId: result.requestId,
  };
}
