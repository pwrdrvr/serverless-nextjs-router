![Build/Deploy CI](https://github.com/pwrdrvr/serverless-nextjs-router/actions/workflows/build.yml/badge.svg) ![Release](https://github.com/pwrdrvr/serverless-nextjs-router/actions/workflows/release.yml/badge.svg)

# Overview

An extension of [serverless-next.js](https://github.com/serverless-nextjs/serverless-next.js) that allows running the Next.js application as AWS Lambda functions are the origin instead of using Lambda @ Edge.

Component used by the [MicroApps framework](https://github.com/pwrdrvr/microapps-core), although the component can also be used without MicroApps.

# Table of Contents <!-- omit in toc -->

- [Overview](#overview)
- [Installation / CDK Constructs](#installation--cdk-constructs)
- [Example Applications Using `serverless-nextjs-router`](#example-applications-using-serverless-nextjs-router)
- [Setting Up New App](#setting-up-new-app)
- [Motivations](#motivations)

# Installation / CDK Constructs

- `npm i --save-dev @pwrdrvr/serverless-nextjs-router`
- Note: The module is used at runtime but only needed at build-time as the router file generally has to be copied into the output folder via a manual build step

# Example Applications Using `serverless-nextjs-router`

- Release App
  - The Release app is an initial, rudimentary, release control console for setting the default version of an application with the [MicroApps framework](https://github.com/pwrdrvr/microapps-core)
  - Built with Next.js
  - [pwrdrvr/microapps-app-release](https://github.com/pwrdrvr/microapps-app-release)
- Next.js Demo App
  - The Next.js Tutorial application deployed as a MicroApp
  - [pwrdrvr/serverless-nextjs-demo](https://github.com/pwrdrvr/serverless-nextjs-demo)

# Setting Up New App

[TBC] The instructions are going to have to wait a bit after 2022-01-30 as there are other components being released, shortly, that make it easier to give an example of how to use this.

# Motivations

[serverless-next.js](https://github.com/serverless-nextjs/serverless-next.js) is a fantastic project in that it allows deploying Next.js applications using Lambda functions.

However, the `Lambda @ Edge` usage by the `serverless-next.js` project may be less than ideal for some consuming projects, for the following reasons:

- In limited cases, Lambda @ Edge is fantastic for quick rendering of server-side rendered pages that `need no AWS origin data`
  - This use case is quite limited in practice
- Speed: Calls to origin have to be carefully consolidated into 1 single origin call
  - Getting a record from DynamoDB, then to get a corresponding file from s3, would cause you wait for the edge to origin latency (e.g. 300 ms RTT from APAC to US East 1) twice, taking 600 ms, vs 300 ms total if calling a service in the origin that hits DyanamoDB then s3 (in the same region)
- Cost: Lambda @ Edge is most cost efficiently used if modifying request or response objects without calling out to origin services; any origin calls will cause the Lambda billing clock to continue running while waiting up to 300 ms for an RTT from edge to origin to make a 1 ms call to DynamoDB
  - Implementing the same @ origin would cost ~1 ms for Lambda @ Edge request transformation (if any) and 1 ms @ origin for the DynamoDB request
  - In this case, the cost would be 2 ms of Lambda vs 300 ms of Lambda @ Edge, a savings of 99% in ms billed (or Lambda @ Edge would bill 150x more than Lambda @ Origin)
  - Lambda @ Origin billing is in 1 ms increments as of Dec 2020: https://aws.amazon.com/about-aws/whats-new/2020/12/aws-lambda-changes-duration-billing-granularity-from-100ms-to-1ms/
  - Lambda @ Edge pricing is $0.00005001 / GB-Sec while Lambda pricing is $0.0000166667 / GB-Sec - Lambda @ Edge is 200% (3x) more expensive than Lambda @ Origin (or, Lambda @ Origin is 66% less expensive than Lambda @ Edge)
  - Added together, Lambda @ Edge for origin calls to DynamoDB would be 450x more expensive than letting CloudFront call back to the origin and hit a Lambda @ Origin which then hits DynamoDB
- Cost - Again: Lambda @ Edge calling DynamoDB (or any other service) from the edge (e.g. APAC) to the origin (e.g. US East 1) will incur elevated Lambda @ Edge billing charges for the entire duration of the DynamoDB call to the origin, including all RTT wire transit time (which will be 500 ms to 1,000 ms in the APAC to US East 1 case). When run with Lambda @ Origin the Lambda billing for wire transit time is completely eliminated.
