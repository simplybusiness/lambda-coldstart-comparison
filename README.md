# lambda-coldstart-comparison

Comparing the coldstart time of AWS Lambda functions using a variety of language runtime and memory size.

This code was the basis for a series of blog posts on the [Simply Business Tech Blog](https://www.simplybusiness.co.uk/about-us/tech/).

## Usage

Run the test with:

```sh
./build.sh
```

You can download X-Ray traces using `download-traces.js`, though at the moment you'll have to manually set `START_TIME` in `download-header.js`. Also, the downloader may output some errors, so it's a good idea to save the output to a file and the errors to another:

```sh
node download-traces.js 2> x-ray-errors.log > x-ray-traces.csv
```

Traces will be represented by a CSV file with the following fields:

* Function name
* Timestamp
* Total duration (ms)
* Setup (ms)
* Initialization (ms)
* Execution (ms)

For example:

```csv
aws-coldstart-ruby25-dev-memory-256,2019-03-06T23:01:23.108Z,182.0,83.0,88.2,10.8
aws-coldstart-ruby25-dev-memory-256,2019-03-06T23:03:53.696Z,186.0,88.4,88.7,8.9
aws-coldstart-ruby25-dev-memory-256,2019-03-06T23:02:14.306Z,202.0,62.4,127.6,12.0
```
