'use strict';

const header = require('./download-header');

const _           = require('lodash');
const AWS         = require('aws-sdk');
AWS.config.region = 'eu-west-1';
const cloudwatch  = new AWS.CloudWatch();
const Lambda      = new AWS.Lambda();

const DAYS = 2;
const ONE_DAY = 24 * 60 * 60 * 1000;

let addDays = (startDt, n) => new Date(startDt.getTime() + ONE_DAY * n);

let getFuncStats = async function(funcName) {
  let getStats = async function(startTime, endTime) {
    let req = {
      MetricName: 'Duration',
      Namespace: 'AWS/Lambda',
      Period: 60,
      Dimensions: [ { Name: 'FunctionName', Value: funcName } ],
      Statistics: [ 'Maximum' ],
      Unit: 'Milliseconds',
      StartTime: startTime,
      EndTime: endTime
    };
    let resp = await cloudwatch.getMetricStatistics(req).promise();

    return resp.Datapoints.map(dp => {
      return {
        timestamp: dp.Timestamp,
        value: dp.Maximum
      };
    });
  };

  let stats = [];
  for (let i = 0; i < DAYS; i++) {
    // CloudWatch only allows us to query 1440 data points per request, which
    // at 1 min period is 24 hours
    let startTime = addDays(header.START_TIME, i);
    let endTime   = addDays(startTime, 1);
    let oneDayStats = await getStats(startTime, endTime);

    stats = stats.concat(oneDayStats);
  }

  return _.sortBy(stats, s => s.timestamp);
};

header.listFunctions()
  .then(async function(funcs) {
    for (let func of funcs) {
      let stats = await getFuncStats(func);
      stats.forEach(stat => console.log(`${func},${stat.timestamp},${stat.value}`));
    }
  });
