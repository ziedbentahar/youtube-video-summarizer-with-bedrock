import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client();

const storeAudio = async (transcriptId: string, audio: Buffer) => {
  await s3Client.send(
    new PutObjectCommand({
      ContentType: "audio/mp3",
      Bucket: process.env.BUCKET_NAME,
      Key: `${transcriptId}/audio`,
      Body: audio,
    })
  );
};

const getPubliclyAvailableUrl = async (transcriptId: string) => {
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: `${transcriptId}/audio`,
    }),
    { expiresIn: 3600 * 24 }
  );

  return url;
};

export { getPubliclyAvailableUrl, storeAudio };
