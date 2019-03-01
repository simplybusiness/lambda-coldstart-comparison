'use strict';

const header = require('./download-header');

const AWS = require('aws-sdk');
AWS.config.region = 'eu-west-1';
const Lambda = new AWS.Lambda();
const { PerformanceObserver, performance } = require('perf_hooks');
const fs = require("fs");
const fetch = require("node-fetch");

// Fairly naive implementation, but it will do.
// See https://gist.github.com/guilhermepontes/17ae0cc71fa2b13ea8c20c94c5c35dc4
const shuffleArray = arr => arr.sort(() => Math.random() - 0.5);

let run = async function () {
  console.log("fetching relevant endpoints...");

  const endpoints = [];

  const restApis = await header.listGateways();
  for (let restApi of restApis) {
    let resources = await header.listResources(restApi.id);
    for (let resource of resources) {
      endpoints.push({
        url: `https://${restApi.id}.execute-api.eu-west-1.amazonaws.com/dev/${resource.name}`,
        func: `${restApi.name.replace(/^dev-/, '')}-dev-${resource.name}`,
      })
    }
  }

  console.log(`found ${endpoints.length} endpoints`);

  console.log("invoking endpoints...");
  for (let endpoint of shuffleArray(endpoints)) {
    performance.mark(`${endpoint.func}-start`);

    const res = await fetch(endpoint.url)
    // const body = await res.text()
    // console.log(body)

    performance.mark(`${endpoint.func}-end`);
    performance.measure(endpoint.func, `${endpoint.func}-start`, `${endpoint.func}-end`);
  }
};

const obs = new PerformanceObserver((list, observer) => {
  for (let entry of list.getEntries()) {
    fs.appendFileSync('local-endpoint-call-durations.csv', `${entry.name},${Date.now()},${entry.duration}\n`);
  }
});
obs.observe({ entryTypes: ['measure'], buffered: true });

run();
