import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client();

const storeTranscript = async (transcriptId: string, transcript: string) => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: `${transcriptId}/transcript`,
      Body: transcript,
    })
  );
};

const getTranscript = async (transcriptId: string) => {
  const output = await s3Client.send(
    new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: `${transcriptId}/transcript`,
    })
  );

  const transcript = await output.Body.transformToString();

  return transcript;
};

export { getTranscript, storeTranscript };
