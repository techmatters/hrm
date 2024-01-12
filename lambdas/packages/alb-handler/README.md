# Lambda ALB Handler

This abstracts away the details of handling ALB requests and responses in lambdas that are meant to be used as ALB targets.

It handles Result types, and converts them to ALB responses.

It handles OPTIONS requests, and converts them to 200 responses with the appropriate CORS headers based on the methodHandlers you provide.

## Usage

see [files-urls/index.ts](../../../hrm-domain/lambdas/files-urls/index.ts) for an example.
