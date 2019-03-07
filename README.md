# lambda-coldstart-comparison
Comparing the coldstart time of AWS Lambda functions using a variety of language runtime and memory size

## Usage

Run the test with:

```sh
./build.sh
```

You can download X-Ray traces using `download-traces.js`, though at the moment you'll have to manually set `START_TIME` in `download-traces.js`. Also, the downloader may output some errors, so it's a good idea to save the output to a file and the errors to another:

```sh
node download-traces.js 2> x-ray-errors.log > x-ray-traces.csv
```
