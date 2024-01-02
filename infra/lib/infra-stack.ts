import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import {
  CustomState,
  DefinitionBody,
  Fail,
  LogLevel,
  StateMachine,
  StateMachineType,
  Succeed,
  TaskInput,
} from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import { resolve } from "path";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const applicationName = "serverless-video-summarizer";

    const bucket = new Bucket(this, `${applicationName}-storage`, {
      bucketName: `${applicationName}-storage`,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      accessControl: BucketAccessControl.PRIVATE,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    });

    const lambdaConfig = {
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      logRetention: RetentionDays.THREE_DAYS,
      handler: "handler",
    };

    const getVideoTranscriptLambda = new NodejsFunction(
      this,
      "getVideoTranscriptLambda",
      {
        ...lambdaConfig,
        functionName: "getVideoTranscript",
        entry: resolve(
          "../src/lambda-handlers/get-youtube-video-transcript.ts"
        ),
        environment: {
          BUCKET_NAME: bucket.bucketName,
        },
      }
    );

    bucket.grantReadWrite(getVideoTranscriptLambda);

    const generateModelParameters = new NodejsFunction(
      this,
      "generateModelParameters",
      {
        ...lambdaConfig,
        functionName: "generateModelParameters",
        entry: resolve("../src/lambda-handlers/generate-model-parameters.ts"),
        environment: {
          BUCKET_NAME: bucket.bucketName,
        },
      }
    );

    bucket.grantReadWrite(generateModelParameters);

    const generateAudioFromSummary = new NodejsFunction(
      this,
      "generateAudioFromSummary",
      {
        ...lambdaConfig,
        functionName: "generateAudioFromSummary",
        entry: resolve("../src/lambda-handlers/generate-audio-from-summary.ts"),
        environment: {
          BUCKET_NAME: bucket.bucketName,
        },
      }
    );

    bucket.grantReadWrite(generateAudioFromSummary);
    generateAudioFromSummary.addToRolePolicy(
      new PolicyStatement({
        actions: ["polly:SynthesizeSpeech"],
        resources: [`*`],
      })
    );

    const failState = new Fail(this, "fail");
    const successState = new Succeed(this, "success");

    const chainDefinition = new LambdaInvoke(this, "get-video-transcript", {
      lambdaFunction: getVideoTranscriptLambda,
      payload: TaskInput.fromObject({
        "requestId.$": "$$.Execution.Name",
        "youtubeVideoUrl.$": "$.youtubeVideoUrl",
      }),
    })
      .addCatch(failState)
      .next(
        new LambdaInvoke(this, "generate-model-parameters", {
          lambdaFunction: generateModelParameters,
          payload: TaskInput.fromObject({
            "requestId.$": "$$.Execution.Name",
          }),
        }).addCatch(failState)
      )
      .next(
        new CustomState(this, "bedrock-invoke-model", {
          stateJson: {
            Type: "Task",
            Resource: "arn:aws:states:::bedrock:invokeModel",
            Parameters: {
              ModelId: "anthropic.claude-v2:1",
              Input: {
                "S3Uri.$": `$.Payload.modelParameters`,
              },
              ContentType: "application/json",
            },
            ResultSelector: {
              "requestId.$": "$$.Execution.Name",
              "summaryTaskResult.$":
                "States.StringToJson(States.Format('\\{{}', $.Body.completion))",
            },
          },
        })
          .addCatch(failState)
          .next(
            new LambdaInvoke(this, "generate-audio-from-summary", {
              lambdaFunction: generateAudioFromSummary,
            }).addCatch(failState)
          )
          .next(successState)
      );

    const stateMachine = new StateMachine(this, "StateMachine", {
      definitionBody: DefinitionBody.fromChainable(chainDefinition),
      stateMachineType: StateMachineType.EXPRESS,
      logs: {
        destination: new LogGroup(this, "ExpressLogs", {
          retention: RetentionDays.ONE_DAY,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
        level: LogLevel.ALL,
        includeExecutionData: true,
      },
    });

    stateMachine.addToRolePolicy(
      new PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:${
            Stack.of(this).region
          }::foundation-model/anthropic.claude-v2:1`,
        ],
      })
    );

    stateMachine.addToRolePolicy(
      new PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [`${bucket.bucketArn}/*`],
      })
    );
  }
}
