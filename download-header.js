'use strict';

const AWS = require('aws-sdk');
AWS.config.region = 'eu-west-1';
const Lambda = new AWS.Lambda();
const APIGateway = new AWS.APIGateway();

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

const listGateways = async function (position, acc) {
  acc = acc || [];

  const resp = await APIGateway.getRestApis({ limit: 100, position }).promise();

  const gateways = resp.items
    .map(i => ({ id: i.id, name: i.name }))
    .filter(item => item.name.includes("aws-coldstart"))

  acc = acc.concat(gateways);

  if (resp.position) {
    return await listGateways(resp.position, acc);
  } else {
    return acc;
  }
};

const listResources = async function (restApiId, position, acc) {
  acc = acc || [];

  const resp = await APIGateway.getResources({ restApiId, limit: 100, position }).promise();

  const resources = resp.items
    .filter(item => item.pathPart)
    .map(item => ({id: item.id, path: item.path, name: item.pathPart}));

  acc = acc.concat(resources);

  if (resp.position) {
    return await listResources(resp.position, acc);
  } else {
    return acc;
  }
}

module.exports = {
  START_TIME: START_TIME,
  listFunctions: listFunctions,
  listGateways: listGateways,
  listResources: listResources,
}
