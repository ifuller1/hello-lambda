"use strict";

let scheduleEventObject = {
  "account": "123456789012",
  "region": "us-east-1",
  "detail": {},
  "detail-type": "Scheduled Event",
  "source": "aws.events",
  "time": "1970-01-01T00:00:00Z",
  "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
  "resources": [
    "arn:aws:events:us-east-1:123456789012:rule/my-schedule"
  ]
};

let FunctionA = require("./dist/functionA.js");
let FunctionB = require("./dist/functionB.js");

var lambdaRunningContext = {
  succeed: function succeed(results)
  {
    console.log(`${results} executed`);

    // Lambda exit.
  }
};

FunctionA.functionA(scheduleEventObject, lambdaRunningContext);
FunctionB.functionB(scheduleEventObject, lambdaRunningContext);