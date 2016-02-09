# hello-lambda
Introduction to using AWS Lambda Functions

At Trail we've been using [Pentaho's open source data integration (Kettle) app]
(http://community.pentaho.com/projects/data-integration/) to design ETL jobs that are used to provide our partner
integrations. As we integrate with more partners we've found some of the more complex integrations harder to achieve. 
Using a GUI to design jobs provides a useful abstraction when they're made up of basic joins and transformations 
but, as some of our jobs have become more complex, working with and understanding the tooling has produced diminishing returns.
 
### Amazon Lambda
Amazon Lambda is a stateless computation-as-a-service (CaaS?) platform, or as Amazon put it *AWS Lambda is a 
compute service where you can upload your code to AWS Lambda and the service can run the code on your behalf using
AWS infrastructure. After you upload your code and create what we call a Lambda function, AWS Lambda takes 
care of provisioning and managing the servers that you use to run the code.*

Using Amazon Lambda we we're able to write our more complex ETL jobs in Node - allowing us to leverage modern debugging tools and practices like TDD.

### Lambda as an ETL runner
We actually reviewed AWS Lambda as an ETL job running platform in the middle of 2015 but the lack of scheduling support stopped us moving ahead. Just a few month later, a lifetime in AWS product development, and Amazon introduced CloudWatch events - time based triggers which you can route to several AWS services including Lambda functions. Using CloudWatch events we're able to configure ETL jobs and have them run on a regular interval - meaning our entire ETL platform could be replaced 
([and cheaply](https://aws.amazon.com/lambda/pricing/)) with AWS Lambda fuctions.
 
### Using AWS Lambda, the basics
Below I'll cover the basics of what we used to setup a Lambda function, if you want to use any of this for yourself
you can use [the following repo](https://github.com/trailsuite/hello-lambda). 

#### Building
We used webpack to bundle multiple Lambda functions into individual artifacts that can be deployed to Lambda. You 
 could probably achieve the same with Babel and Gulp but we've been using webpack recently and like the functionality 
 it provides.
 
To bundle our Lambda functions we used multiple entry points by parsing `./src/lambdas` and using the [webpacks entry
point configuration](https://github.com/webpack/webpack/tree/master/examples/multiple-entry-points).

```javascript
...
function createEntryPoints()
{
  let entryPointsArray = fs.readdirSync(path.join(__dirname, LAMBDAS_PATH))
      .map(filename =>
      {
        return {
          [filename.replace(".js", "")]: path.join(_dirname, LAMBDAS_PATH, filename)
        };
      });

  return entryPointsArray.reduce((returnObject, entryItem) =>
  {
    return Object.assign(returnObject, entryItem);
  }, {});
}

module.exports = {
  entry:createEntryPoints(),
...
```

With this and an entry in the npm package script block we can run `npm run-script watch` to start building 
./src/lambdas for deployment.

#### Running
The Lambda runtime expects to call a Lambda function with an event object and context. Lambda depends on these 
parameters to provide event details and a callback that allows the Lambda function to indicate its completion. 
To provide parity between your local environment and the Lambda runtime you can create a simple run.js as follows:

```javascript
let scheduleEventObject = {
  "account": "123456789012",
  ...
};

let FunctionA = require("./dist/functionA.js");
let FunctionB = require("./dist/functionB.js");

let lambdaRunningContext = {
  succeed: ...
};

FunctionA.functionA(scheduleEventObject, lambdaRunningContext);
```

#### Using environment variables
Using Lambda as an ETL runner required us to include some secure keys, like sftp credentials. Unfortunately Lambda
doesn't provide a way to manage environment keys so we looked at Amazon KMS (key management service) to encrypt and then decrypt the variables at runtime. We've omitted this process from the sample project but the following code along with a no-parse.js provides us with a workable solution.
  
```javascript
function loadEnvironmentVariables(callback)
{
  let kms = new AWS.KMS({region: 'eu-west-1'});
  let encryptedSecret = fs.readFileSync("./encrypted.env");
  let decryptedSecret;

  kms.decrypt({CiphertextBlob: encryptedSecret}, (err, decryptedData) =>
  {
    if (err)
    {
      console.log(err, err.stack);
    }
    else
    {
      decryptedSecret = decryptedData['Plaintext'].toString();
      fs.writeFileSync('/tmp/.env', decryptedSecret);
      require('dotenv').config({path: '/tmp/.env'});
      
      callback();
    }
  });
}
```

#### Preparing AWS
Before you can deploy your lambda function you need to configure it on AWS. If like us, your default region is Ireland you would go to [https://eu-west-1.console.aws.amazon.com/lambda/home?region=eu-west-1#/create](https://eu-west-1.console.aws.amazon.com/lambda/home?region=eu-west-1#/create) and create a Lambda function named `functionA`. The handler name is generated from the imported module name, followed by the exported function. In our example we have functionA.js as the imported module and functionA as the function which means the **Handler** should be set to `functionA.functionA`. You'll also need a role with the right execution policy, we're using the following: 

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

You'll need to manually provide the packaged zip file when first configuring the Lambda, but once it's configured you can use the automated deployment below. 

For further detail on creating Lambda functions you can follow the AWS docs [here](http://docs.aws.amazon.com/lambda/latest/dg/get-started-create-function.html)

#### Deploying to AWS
We use both CircleCI and Codeship to at Trail. For simplicity we're using Codeship to build test and
deploy our Lambda functionsla. For the deployment to run you'll need to set the following environment variables on Codeship:

```
AWS_ACCESS_KEY_ID
AWS_DEFAULT_REGION
AWS_SECRET_ACCESS_KEY
```

We then use the following **Setup Commands**
```
pip install awscli
nvm install 4.2.4
npm install
npm run-script build
```

along with a **Test Pipeline** consisting of
```
npm test
```
to successfully run our tests.

To deploy the built artifacts we created the following script, which zips and deploys a given function to AWS. Using 
this script you can setup a deployment pipeline on Codeship providing the function you're trying to deploy, e.g. .
`./deploy.script functionA`.

```
#!/bin/bash
echo "Hello $1"

cd ./dist/

zip -r $1.zip ./$1.js 

aws lambda update-function-code --function-name "$1" --zip-file fileb://$1.zip
aws lambda get-function --function-name "$1"
aws lambda invoke --function-name "$1" --payload "{}" output.log

if grep -q error output.log; then
        echo "There were errors deploying and running $1 :("
        cat output.log
        exit 1
else
        echo "$1 deployed!"
fi
```

### A Note on performance
When we initially deployed our ETL jobs we noticed that network requests were failing, or even worse that the whole job was timing out within Lambdas five minute limit. After some research we realised that the memory configuration for our Lambda jobs (defaulted to 128MB) was directly tied to the CPU performance of the Lambda environment. Additionally, with out ETL schedules being set to twenty or more minutes, the Lambda environment was running from cold. Increasing the memory allocation on our Lambda functions also increased the performance, removing any of these issues - and the prices is still a fraction of our existing setup. 

### Reference
Feel free to take a look at our reference project https://github.com/trailsuite/hello-lambda. We've been impressed
with how easy Lambda was to work with and how it might improve our pipeline. If you're interesting in working with technologies like this to solve difficult problems, then get in touch.
