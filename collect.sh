#!/bin/bash

echo "Downloading CloudWatch IntegrationLatency for API Gateway..."
node download-gateway-stats.js > gateway-integration-latencies.csv

echo "Downloading duration for X-Ray traces..."
node download-traces.js > xray-trace-durations.csv

echo "Downloading CloudWatch duration for lambda functions..."
node download-stats.js > lambda-durations.csv

echo "Summary of CSV files"
wc -l *csv
