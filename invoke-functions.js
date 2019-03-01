'use strict';

const header = require('./download-header');

const AWS = require('aws-sdk');
AWS.config.region = 'eu-west-1';
const Lambda = new AWS.Lambda();
const { PerformanceObserver, performance } = require('perf_hooks');
const fs = require("fs");

// Fairly naive implementation, but it will do.
// See https://gist.github.com/guilhermepontes/17ae0cc71fa2b13ea8c20c94c5c35dc4
const shuffleArray = arr => arr.sort(() => Math.random() - 0.5);

let run = async function () {
  console.log("fetching relevant functions...");

  const functions = await header.listFunctions();
  console.log(`found ${functions.length} functions`);

  console.log("invoking $LATEST...");
  for (let func of shuffleArray(functions)) {
    performance.mark(`${func}-start`);

    const res = await Lambda.invoke({
      FunctionName: func,
      InvocationType: "RequestResponse"
    }).promise()

    performance.mark(`${func}-end`);
    performance.measure(func, `${func}-start`, `${func}-end`);
  }
};

const obs = new PerformanceObserver((list, observer) => {
  for (let entry of list.getEntries()) {
    fs.appendFileSync('local-call-durations.csv', `${entry.name},${Date.now()},${entry.duration}\n`);
  }
});
obs.observe({ entryTypes: ['measure'], buffered: true });

run();
