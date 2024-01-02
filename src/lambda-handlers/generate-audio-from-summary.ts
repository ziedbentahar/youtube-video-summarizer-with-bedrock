import {
  getPubliclyAvailableUrl,
  storeAudio,
} from "adapters/audio-summary-repository";
import { synthesize } from "adapters/speech-synthesis";

export const handler = async (event: SummaryTaskOutput) => {
  const audio = await synthesize(event.summaryTaskResult);
  await storeAudio(event.requestId, audio);

  return {
    videoSummary: {
      ...event.summaryTaskResult,
      audioUrl: await getPubliclyAvailableUrl(event.requestId),
    },
  };
};

type SummaryTaskOutput = {
  requestId: string;
  summaryTaskResult: {
    speakers: string[];
    topics: string;
    summary: string[];
  };
};
