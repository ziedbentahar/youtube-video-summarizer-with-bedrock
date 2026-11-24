# Architecture diagram

Mermaid diagram of the deployed system, derived from `infra/lib/infra-stack.ts` and `src/`. GitHub renders it inline. Findings referenced here (WF-1 and so on) are in [architecture-review.md](./architecture-review.md).

```mermaid
flowchart LR
    Caller(["Caller<br/>(no API or trigger in the stack)"])
    YT[("YouTube<br/>watch page + youtubei API")]

    subgraph AWS["AWS account"]
        direction LR

        subgraph SM["Step Functions Express state machine"]
            direction TB
            T1["1. get-video-transcript<br/>Lambda, Node 20 ARM64, 512 MB, 60 s"]
            T2["2. generate-model-parameters<br/>Lambda"]
            T3["3. bedrock-invoke-model<br/>CustomState bedrock:invokeModel"]
            T4["4. generate-audio-from-summary<br/>Lambda"]
            OK(["success"])
            F(["fail<br/>(no Error/Cause)"])
            T1 --> T2 --> T3 --> T4 --> OK
            T1 -.-> F
            T2 -.-> F
            T3 -.-> F
            T4 -.-> F
        end

        S3[("S3 bucket<br/>serverless-video-summarizer-storage<br/>requestId/transcript<br/>requestId/modelParameters<br/>requestId/audio")]
        Bedrock["Amazon Bedrock<br/>anthropic.claude-v2:1"]
        Polly["Amazon Polly<br/>SynthesizeSpeech (SSML)"]
        CW[("CloudWatch Logs<br/>ALL level, execution data, 1-day retention")]
    end

    Caller -- "StartSyncExecution<br/>{ youtubeVideoUrl }" --> T1
    T4 -- "summary + presigned audio URL (24 h)" --> Caller

    T1 -- "fetch transcript" --> YT
    T1 -- "PUT transcript" --> S3
    T2 -- "GET transcript" --> S3
    T2 -- "PUT modelParameters" --> S3
    T3 -- "GET modelParameters" --> S3
    T3 -- "InvokeModel" --> Bedrock
    T4 -- "synthesize per chunk" --> Polly
    T4 -- "PUT audio" --> S3
    SM -.-> CW
```

## Sequence view

```mermaid
sequenceDiagram
    participant C as Caller
    participant SF as Step Functions (Express)
    participant L1 as Lambda: get-video-transcript
    participant L2 as Lambda: generate-model-parameters
    participant B as Bedrock (claude-v2:1)
    participant L3 as Lambda: generate-audio-from-summary
    participant S3 as S3
    participant P as Polly

    C->>SF: StartSyncExecution { youtubeVideoUrl }
    SF->>L1: invoke
    L1->>S3: PUT requestId/transcript
    L1-->>SF: transcript location
    SF->>L2: invoke
    L2->>S3: GET transcript
    L2->>S3: PUT requestId/modelParameters
    L2-->>SF: Payload.modelParameters
    SF->>B: InvokeModel (body from S3)
    B-->>SF: completion
    SF->>L3: invoke (summary JSON)
    loop each sentence / chunk
        L3->>P: SynthesizeSpeech
    end
    L3->>S3: PUT requestId/audio
    L3-->>SF: summary + presigned URL
    SF-->>C: output (any failure: FAILED, no error/cause)
```
