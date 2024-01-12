# Lambda Microservices

# Lambda Microservices

The beginnings of a framework for building HRM/resources microservices using lambdas was started with the [files-urls](../hrm-domain/lambdas/files-urls/index.ts) lambda. This is a good starting point for understanding how the framework works.

The framework is based on the [lambda-alb-handler](../lambdas/packages/alb-handler/README.md) package, which abstracts away the details of handling ALB requests and responses in lambdas that are meant to be used as ALB targets.

The framework also uses the [lambda-authentication](../lambdas/packages/lambda-authentication/README.md) package, which abstracts away the details of handling authentication in lambda microservices.

## Overview

The intention of the framework is to add the ability to replace and extend the current twilio serverless functions with a more flexible and powerful framework for building microservices on lambdas.

The framework is based on the following principles:

- Each microservice is a single lambda function
- Each microservice should fit into the existing HRM/resources permission system
- Each microservice should fit into the existing HRM/resource url path system

## Terragrunt Management

The infrastructure setup for the microservices is managed using terragrunt. Documentation for the terragrunt setup can be found [here](https://github.com/techmatters/infrastructure-config/blob/master/docs/hrm-microservices.md).
