'use strict';

const AWS = require('aws-sdk');
AWS.config.region = 'eu-west-1';
const Lambda = new AWS.Lambda();

const START_TIME = new Date('2019-02-27T09:00:00.000Z');

const listFunctions = async function (marker, acc) {
  acc = acc || [];

  let resp = await Lambda.listFunctions({ Marker: marker, MaxItems: 100 }).promise();

  let functions = resp.Functions
    .map(f => f.FunctionName)
    .filter(fn => fn.includes("aws-coldstart") && !fn.endsWith("run"));

  acc = acc.concat(functions);

  if (resp.NextMarker) {
    return await listFunctions(resp.NextMarker, acc);
  } else {
    return acc;
  }
};

module.exports = {
  START_TIME: START_TIME,
  listFunctions: listFunctions,
}
