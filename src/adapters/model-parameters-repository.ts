import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client();
const MAX_TOKEN_TO_SAMPLE = 4000
const getModelParameters = (prompt: string) => {
  const modelParameters = {
    prompt,
    max_tokens_to_sample: MAX_TOKEN_TO_SAMPLE,
    top_k: 250,
    top_p: 1,
    temperature: 0.2,
    stop_sequences: ["Human:"],
    anthropic_version: "bedrock-2023-05-31",
  };

  return modelParameters;
};

const storeModelParametersForPrompt = async (
  transcriptId: string,
  prompt: string
) => {
  const modelParameters = getModelParameters(prompt);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: `${transcriptId}/modelParameters`,
      Body: JSON.stringify(modelParameters),
    })
  );
};

const getModelParametersUri = (transcriptId: string) => {
  return `s3://${process.env.BUCKET_NAME}/${transcriptId}/modelParameters`;
};

export { getModelParametersUri, storeModelParametersForPrompt };
