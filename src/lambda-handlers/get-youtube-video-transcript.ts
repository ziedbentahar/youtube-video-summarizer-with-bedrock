import { storeTranscript } from "adapters/transcript-repository";
import { YoutubeTranscript } from "youtube-transcript";

export const handler = async (event: {
  youtubeVideoUrl: string;
  requestId: string;
}) => {
  const { youtubeVideoUrl, requestId } = event;
  const transcript = await YoutubeTranscript.fetchTranscript(youtubeVideoUrl);
  const sentences = Array.from(getSentencesFromYoutubeTranscript(transcript));

  await storeTranscript(requestId, sentences.join("\n"));
};

function* getSentencesFromYoutubeTranscript(transcript: { text: string }[]) {
  let currentSentence: string[] = [];
  let i = 0;
  do {
    const { text } = transcript[i];

    currentSentence.push(text);

    if (text.endsWith(".")) {
      yield currentSentence.join(" ").replaceAll("\n", " ");
      currentSentence = [];
    }
    i++;
  } while (i < transcript.length);

  yield currentSentence.join(" ").replaceAll("\n", " ");
}
