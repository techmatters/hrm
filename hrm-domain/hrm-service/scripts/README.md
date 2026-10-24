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
| ├── hrm:            # Republish contacts and cases based on date range
├── reexport
| ├── hrm:            # Re-export contacts, cases and profiles based on date range
├── stats
| ├── list-accounts:  # List the account short codes and sids in an environment, grouped by region
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

Commands with type `[boolean]` in the help info can be set to true be adding the parameter without a value. So `-s` is a boolean parameter for the reexport tool. If not specified it is assumed false, here is an example of it being set true
`npm run admin-cli reexport hrm -- -a ACxx -e development -r us-east-1 -f 2000-01-01 -t 2030-01-01 -s`

Commands with type `[array]` in the help info can be passed as a space-separate-list or as individual flags, so for example
`npm run admin-cli reexport hrm -- -a ACxx1 ACxx2 ACxx3 -e development -r us-east-1 -f 2000-01-01 -t 2030-01-01 -s`
results in the same command as
`npm run admin-cli reexport hrm -- -a ACxx1 -a ACxx2 -a ACxx3 -e development -r us-east-1 -f 2000-01-01 -t 2030-01-01 -s`
#### Running against every account in a region
For `reindex hrm`, `republish hrm` and `reexport hrm`, the `-a/--accounts` parameter is optional. If omitted, the command runs for every account whose `/<environment>/aws/<account sid>/region` SSM parameter matches the given region, after asking for confirmation.
Use `-d/--dry-run` to list the account sids the command would run for, without running it
`npm run admin-cli reindex hrm -- -e development -r us-east-1 -f 2000-01-01 -t 2030-01-01 --dry-run`
Use `--exclude-accounts` (short codes or account sids) to leave accounts out, e.g. every account in the region except ZA
`npm run admin-cli reindex hrm -- -e development -r us-east-1 -f 2000-01-01 -t 2030-01-01 --exclude-accounts ZA --dry-run`

#### Targeting specific entities by id
`reindex hrm`, `republish hrm` and `reexport hrm` can target specific contacts, cases or profiles, by passing their ids as a JSON list with `--ids`, or as the path to a JSON file containing the list with `--ids-file`. Exactly one entity type must be specified. `-f/--dateFrom` and `-t/--dateTo` are then optional; if given, only the ids updated within that range are targeted
`npm run admin-cli reindex hrm -- -a ACxx -e development -r us-east-1 -c --ids '[1234, 5678]'`
`npm run admin-cli reexport hrm -- -a ACxx -e development -r us-east-1 -s --ids-file ./case-ids.json`

#### Listing accounts
`stats list-accounts` lists the short code and account sid of every account in an environment, grouped by region, from the `/<environment>/twilio/<short code>/account_sid` and `/<environment>/aws/<account sid>/region` SSM parameters. Pass `-r` to only list the accounts in one region
`npm run admin-cli stats list-accounts -- -e development -r us-east-1`
