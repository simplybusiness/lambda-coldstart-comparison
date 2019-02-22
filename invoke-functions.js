'use strict';

const AWS = require('aws-sdk');
AWS.config.region = 'eu-west-1';
const Lambda = new AWS.Lambda();
const { PerformanceObserver, performance } = require('perf_hooks');
const fs = require("fs");

let functions = [];

let listFunctions = async function (marker, acc = []) {
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

// Fairly naive implementation, but it will do.
// See https://gist.github.com/guilhermepontes/17ae0cc71fa2b13ea8c20c94c5c35dc4
const shuffleArray = arr => arr.sort(() => Math.random() - 0.5);

let run = async function () {
  if (functions.length == 0) {
    console.log("fetching relevant functions...");

    functions = await listFunctions();
    console.log(`found ${functions.length} functions`);
  }

  console.log("invoking $LATEST...");
  for (let func of shuffleArray(functions)) {
    performance.mark(`${func}-start`);

    await Lambda.invoke({
      FunctionName: func,
      InvocationType: "Event"
    }).promise()

    performance.mark(`${func}-end`);
    performance.measure(func, `${func}-start`, `${func}-end`);
  }
};

const obs = new PerformanceObserver((list, observer) => {
  for (let entry of list.getEntries()) {
    fs.appendFileSync('invoke-functions.csv', `${entry.name},${Date.now()},${entry.duration}\n`);
  }
});
obs.observe({ entryTypes: ['measure'], buffered: true });

run();
