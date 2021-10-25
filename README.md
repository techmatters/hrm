[![Actions Status](https://github.com/tech-matters/hrm/workflows/hrm-ci/badge.svg)](https://github.com/tech-matters/hrm/actions)
# hrm

The Helpline Relationship Management (HRM) system is the backend for the Aselo system.  It is built as an Express/NodeJS REST API accessed by the [Aselo frontend](https://www.twilio.com/docs/flex/developer/plugins).  See [aselo.org](https://aselo.org/) or [contact Aselo](https://aselo.org/contact-us/) for more information.

## git-secrets
In order to prevent sensitive credentials to be leaked, please follow this instructions to setup `git-secrets`.
- Install [git-secrets](https://github.com/awslabs/git-secrets) in your computer.
- Go into the repo root folder.
- Run `git secrets --register-aws`.
- Run `git config --local core.hooksPath .githooks/`.