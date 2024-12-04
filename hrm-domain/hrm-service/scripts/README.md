### Description
`admin-cli` is an internal tool intended to be used by the Aselo staff.

This is composition of different scripts that will allow to perform actions against HRM server/database without the need to manually running queries or hitting endpoints.

### Requirements
- Access to Management/EU VPN (depending on the target environment)
- Access to the devops instance
- Once connected to the VPN and SSHed into the devops instance you need to clone this repo (if your user does not have it yet)
  `git clone https://github.com/techmatters/hrm`
- Install the dependencies (if not done yet)
  `npm ci`

### Available commands
```bash
admin-cli
├── profiles
| ├── identifiers
|   ├── create:       # Create a new identifier and associate a profile to it
| ├── flags
|   ├── list:         # List the profile flags for the given account
|   ├── create:       # Create a new profile flag
|   ├── edit:         # Edit an existing profile flag
|   ├── delete:       # Delete an existing profile flag
├── reindex
| ├── hrm:            # Reindex contacts and cases based on date range
├── republish
| ├── hrm:            # Reindex contacts and cases based on date range
```

### Usage
Run admin commands like  
`npm run admin-cli`

To get more information about the scripts available  
`npm run admin-cli -- --help`

To get about a specific command  
`npm run admin-cli <command> -- --help`
where `<command>` is the command you are trying to run

Each command might have sub-commands. For example, if you want to run "list available profile flags" script  
`npm run admin-cli profile flags list`

Each command might have required parameters, which will be promted to you in case you miss them. However, is adviced to use `--help` before actually running commands.  
For example, to list client profiles for development in us-east-1 region, you can run  
`npm run admin-cli profile flags list -- -r=us-east-1 -e=development -a=<development account sid>`
