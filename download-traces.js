'use strict';

const header =    require('./download-header');
const _           = require('lodash');
const AWS         = require('aws-sdk');
AWS.config.region = 'eu-west-1';
const xray        = new AWS.XRay();

let getFuncTraces = async function(funcName) {
  let getTraces = async function(startTime, endTime, nextToken=null) {
    let xReq = {
      EndTime: endTime,
      StartTime: startTime,
      FilterExpression: `service("${funcName}")`,
      NextToken: nextToken,
    }
    let xResp = await xray.getTraceSummaries(xReq).promise();
    const traces = xResp.TraceSummaries.map(summary => ({id: summary.Id, duration: summary.Duration, responseTime: summary.ResponseTime}));

    if (xResp.NextToken) {
      return traces.concat(await getTraces(startTime, endTime, xResp.NextToken));
    } else {
      return traces;
    }
  };

  return await getTraces(header.START_TIME, new Date());
};

// This method will return an array of traces with the following shape:
// {
//   functionName: 'aws-coldstart-ruby25vpc-dev-outside-1536',
//   traceId: '1-5c7954d9-560bf598fb3f88607c3751e0',
//   timestamp: '2019-03-06T15:38:27.308Z',
//   durations:
//     [
//       { name: 'AWS::Lambda', id: '2cd1290ee882c1b0', duration: '376.0' },
//       { name: 'AWS::Lambda::Function', id: '3f252a557b9d011f', duration: '2.5' },
//       { name: 'Overhead', id: '51b1a64aa8e9f0f3', duration: '0.7' },
//       { name: 'Initialization', id: '1b94ef3ef1233694', duration: '173.4' },
//       { name: 'Invocation', id: 'f7a89c8152f3451b', duration: '1.3' },
//       { name: 'Setup', id: null, duration: '200.1' }
//     ]
// ]
const getTraceDetails = async function(traceIds) {
  if (traceIds.length == 0)
    return [];

  // batchGetTraces accepts a max of 5 IDs: so we need to call it in chunks
  const chunkIds = traceIds.slice(0, 5);
  const restIds = traceIds.slice(5);

  const xReq = {
    TraceIds: chunkIds,
  };
  const xResp = await xray.batchGetTraces(xReq).promise();

  const chunkDetails = xResp.Traces.map(trace => {
    const traceId = trace.Id;

    const lambdaSegment = trace.Segments.find(segment => JSON.parse(segment.Document).origin === 'AWS::Lambda');
    const lambdaSegmentDocument = JSON.parse(lambdaSegment.Document);

    const functionName = lambdaSegmentDocument.name;
    const timestamp = (new Date(lambdaSegmentDocument.start_time * 1000)).toISOString();

    const lambdaFunctionSegment = trace.Segments.find(segment => JSON.parse(segment.Document).origin === 'AWS::Lambda::Function');

    if (! lambdaFunctionSegment) {
      console.error('Missing lambda function segment for', traceId);
      return {
        functionName,
        traceId,
        timestamp,
        durations: [],
      }
    }

    const lambdaFunctionSegmentDocument = JSON.parse(lambdaFunctionSegment.Document);

    const lambdaSegmentTime = ((lambdaSegmentDocument.end_time - lambdaSegmentDocument.start_time) * 1000).toFixed(1);
    const lambdaFunctionSegmentTime = ((lambdaFunctionSegmentDocument.end_time - lambdaFunctionSegmentDocument.start_time) * 1000).toFixed(1);

    const segments = [
      {
        name: lambdaSegmentDocument.origin,
        id: lambdaSegment.Id,
        duration: lambdaSegmentTime,
      },
      {
        name: lambdaFunctionSegmentDocument.origin,
        id: lambdaFunctionSegment.Id,
        duration: lambdaFunctionSegmentTime,
      },
    ]
    const subsegments = lambdaFunctionSegmentDocument.subsegments.map(subsegment => {
      return {
        name: subsegment.name,
        id: subsegment.id,
        duration: ((subsegment.end_time - subsegment.start_time) * 1000).toFixed(1),
      }
    });

    const initializationSubsegment = subsegments.find(subsegment => subsegment.name === 'Initialization');

    if (! initializationSubsegment) {
      console.error('Missing Initialization subsegment for', traceId);
      return {
        functionName,
        traceId,
        timestamp,
        durations: [],
      }
    }

    const initializationTime = initializationSubsegment.duration;

    const setup = {
      name: 'Setup',
      id: null,
      duration: (lambdaSegmentTime - lambdaFunctionSegmentTime - initializationTime).toFixed(1),
    };

    return {
      functionName,
      traceId,
      timestamp,
      durations: segments.concat(subsegments).concat([setup])
    }
  });

  return chunkDetails.concat(await getTraceDetails(restIds));
}

// Output will be a in CSV format, with the following columns:
//
// function,timestamp,total_time,setup_time,initialization_time,execution_time
// aws-coldstart-ruby25-dev-memory-256,2019-03-06T15:36:12.078Z,206.0,88.2,98.2,19.6
header.listFunctions()
  .then(async function(funcs) {
    for (let func of funcs) {
      let stats = await getFuncTraces(func);
      let details = await getTraceDetails(stats.map(stat => stat.id));

      details.forEach((trace) => {
        if (trace.durations.length > 0) {
          const output = [
            trace.functionName,
            trace.timestamp,
            trace.durations.find(info => info.name == 'AWS::Lambda').duration,
            trace.durations.find(info => info.name == 'Setup').duration,
            trace.durations.find(info => info.name == 'Initialization').duration,
            trace.durations.find(info => info.name == 'AWS::Lambda::Function').duration,
          ];
          console.log(output.join(','));
        }
      });
    }
  });
