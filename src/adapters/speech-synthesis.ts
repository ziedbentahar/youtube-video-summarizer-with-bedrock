import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

const polly = new PollyClient({});

const synthesize = async (data: { topics: string; summary: string[] }) => {
  const audioBuffers = [];
  for (const sentence of data.summary) {
    const sentenceWithBreak = `${sentence} <break strength="x-strong" />`;

    const paragraphBuffers = await Promise.all(
      chunkString(sentenceWithBreak, 1500).map((chunk) => {
        return polly
          .send(
            new SynthesizeSpeechCommand({
              OutputFormat: "mp3",
              TextType: "ssml",
              Text: `<speak>${chunk}</speak>`,
              Engine: "neural",
              VoiceId: "Joanna",
              LanguageCode: "en-US",
            })
          )
          .then((data) => data.AudioStream.transformToByteArray())
          .then((byteArray) => Buffer.from(byteArray));
      })
    );
    audioBuffers.push(...paragraphBuffers);
  }

  const mergedBuffers = audioBuffers.reduce(
    (total: Buffer, buffer: any) =>
      Buffer.concat([total, buffer], total.length + buffer.length),
    Buffer.alloc(1)
  );
  return mergedBuffers;
};

const chunkString = (paragraph: string, chunkSize: number) => {
  let splitString = [];
  for (let i = 0; i < paragraph.length; i = i + chunkSize) {
    splitString.push(paragraph.slice(i, i + chunkSize));
  }
  return splitString;
};

export { synthesize };
