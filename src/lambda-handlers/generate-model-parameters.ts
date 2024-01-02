import {
  getModelParametersUri,
  storeModelParametersForPrompt,
} from "adapters/model-parameters-repository";
import { getTranscript } from "adapters/transcript-repository";

const videoSummarizationTaskTemplate = `"
You are a video transcript summarizer. Summarize this transcript in a third person point of view in 10 sentences. 
Identify the speakers and the main topics of the transcript and add them in the output as well. 
Do not add or invent speaker names if you not able to identify them.
Please output the summary JSON format conforming to thi JSON schema:
{
  "type": "object",
  "properties": {
    "speakers": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "topics": {
      "type": "string"
    },
    "summary": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}

<transcript>{{transcript}}</transcript>
"`;

const promptTemplate = "\n\nHuman:{{prompt}}\n\nAssistant:{";

const MAX_TOKEN = 200_000;

export const handler = async (event: { requestId: string }) => {
  const { requestId } = event;

  const transcript = await getTranscript(requestId);

  const videoSummarizationTask = videoSummarizationTaskTemplate.replaceAll(
    "{{transcript}}",
    transcript.slice(
      0,
      MAX_TOKEN - videoSummarizationTaskTemplate.length - promptTemplate.length
    )
  );

  const prompt = promptTemplate.replaceAll(
    "{{prompt}}",
    videoSummarizationTask
  );

  await storeModelParametersForPrompt(requestId, prompt);

  return {
    modelParameters: getModelParametersUri(requestId),
  };
};
