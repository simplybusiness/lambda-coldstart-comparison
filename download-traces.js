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
//   times:
//     [
//       { name: 'AWS::Lambda', id: '2cd1290ee882c1b0', time: '376.0' },
//       { name: 'AWS::Lambda::Function', id: '3f252a557b9d011f', time: '2.5' },
//       { name: 'Overhead', id: '51b1a64aa8e9f0f3', time: '0.7' },
//       { name: 'Initialization', id: '1b94ef3ef1233694', time: '173.4' },
//       { name: 'Invocation', id: 'f7a89c8152f3451b', time: '1.3' },
//       { name: 'Setup', id: null, time: '200.1' }
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

    const lambdaFunctionSegment = trace.Segments.find(segment => JSON.parse(segment.Document).origin === 'AWS::Lambda::Function');
    const lambdaFunctionSegmentDocument = JSON.parse(lambdaFunctionSegment.Document);

    const lambdaSegmentTime = ((lambdaSegmentDocument.end_time - lambdaSegmentDocument.start_time) * 1000).toFixed(1);
    const lambdaFunctionSegmentTime = ((lambdaFunctionSegmentDocument.end_time - lambdaFunctionSegmentDocument.start_time) * 1000).toFixed(1);

    const segments = [
      {
        name: lambdaSegmentDocument.origin,
        id: lambdaSegment.Id,
        time: lambdaSegmentTime,
      },
      {
        name: lambdaFunctionSegmentDocument.origin,
        id: lambdaFunctionSegment.Id,
        time: lambdaFunctionSegmentTime,
      },
    ]
    const subsegments = lambdaFunctionSegmentDocument.subsegments.map(subsegment => {
      return {
        name: subsegment.name,
        id: subsegment.id,
        time: ((subsegment.end_time - subsegment.start_time) * 1000).toFixed(1),
      }
    });

    const initializationTime = subsegments.find(subsegment => subsegment.name === 'Initialization').time;

    const setup = {
      name: 'Setup',
      id: null,
      time: (lambdaSegmentTime - lambdaFunctionSegmentTime - initializationTime).toFixed(1),
    };

    return {
      functionName,
      traceId,
      times: segments.concat(subsegments).concat([setup])
    }
  });

  return chunkDetails.concat(await getTraceDetails(restIds));
}

// Output will be a in CSV format, with the following columns:
//
// function,total_time,setup_time,initialization_time,execution_time
// aws-coldstart-ruby25-dev-memory-512,370.0,200.3,167.5,2.2
header.listFunctions()
  .then(async function(funcs) {
    for (let func of funcs) {
      let stats = await getFuncTraces(func);
      let details = await getTraceDetails(stats.map(stat => stat.id));

      details.forEach((trace) => {
        const output = [
          trace.functionName,
          trace.times.find(info => info.name == 'AWS::Lambda').time,
          trace.times.find(info => info.name == 'Setup').time,
          trace.times.find(info => info.name == 'Initialization').time,
          trace.times.find(info => info.name == 'AWS::Lambda::Function').time,
        ];
        console.log(output.join(','));
      });
    }
  });
