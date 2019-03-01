'use strict';

const header = require('./download-header');

const _           = require('lodash');
const AWS         = require('aws-sdk');
AWS.config.region = 'eu-west-1';
const cloudwatch  = new AWS.CloudWatch();

const DAYS = 2;
const ONE_DAY = 24 * 60 * 60 * 1000;

let addDays = (startDt, n) => new Date(startDt.getTime() + ONE_DAY * n);

let getEndpointStats = async function(resource) {
  let getStats = async function(startTime, endTime) {
    let req = {
      MetricName: 'IntegrationLatency',
      Namespace: 'AWS/ApiGateway',
      Period: 60,
      Dimensions: [
        { Name: 'ApiName', Value: resource.apiName },
        { Name: 'Resource', Value: resource.path },
        { Name: 'Method', Value: 'GET' },
        { Name: 'Stage', Value: 'dev' },
      ],
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

header.listGateways()
  .then(async function(restApis) {
    for (let restApi of restApis) {
      let resources = await header.listResources(restApi.id);
      for (let resource of resources) {
        let stats = await getEndpointStats({apiName: restApi.name, ...resource});
        stats.forEach(stat => console.log(`${restApi.name.replace(/^dev-/, '')}-dev-${resource.name},${stat.timestamp},${stat.value}`));
      }
    }
  });
