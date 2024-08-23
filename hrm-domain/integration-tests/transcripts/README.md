# Transcript Integration Tests

## Running Locally

### Prerequisites

You need to have logged in to the Private AI docker registry to pull the container and ensured your local repo has a Private AI licence file. 

Instructions here: https://techmatters.app.box.com/notes/1619547657041

### Running the tests

From the repo root

Entire integration test suite
```bash
npm run test:integration 
```

Transcript tests only:
```bash
npm run test:integration -w hrm-domain/integration-tests/transcripts
```