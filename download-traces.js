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

header.listFunctions()
  .then(async function(funcs) {
    for (let func of funcs) {
      let stats = await getFuncTraces(func);
      stats.forEach(stat => console.log(`${func},${stat.duration * 1000},${stat.responseTime * 1000}`));
    }
  });
