const util = require('util');
const exec = util.promisify(require('child_process').execSync);
const fs = require('fs');
const yargs = require('yargs');

async function main() {
  const args = yargs(process.argv.slice(2))
    .command(
      '$0',
      'Automatically generate a liquibase migration script based on changes in your local DB. WARNING - DOES NOT MIGRATE DATA.',
    )
    .option('d', {
      type: 'boolean',
      alias: 'docker',
      describe:
        'Specify if you are using a docker database using /docker-database/docker-compose.yml or /docker-database/docker-compose-persistent.yml rather than one running locally on the host',
    })
    .parseSync();
  const propertiesFile = args.docker
    ? '/liquibase/changelog/liquibase.for-docker-db.properties'
    : '/liquibase/changelog/liquibase.properties';
  await exec(
    `docker run --rm -v ${process.cwd()}/liquibase:/liquibase/changelog --network docker-database_default liquibase/liquibase  --log-level debug --defaults-file ${propertiesFile} --url offline:postgresql?snapshot=changelog/current-snapshot.json --reference-url jdbc:postgresql://${args.docker ? 'db' : 'localhost'}:5432/hrmdb diff-changelog`,
  );
  const timestamp = new Date();
  fs.copyFileSync(
    './liquibase/current-snapshot.json',
    `./liquibase/snapshots/previous-snapshot-${timestamp.getUTCFullYear()}${timestamp.getUTCMonth()}${timestamp.getUTCDay()}${timestamp.getUTCHours()}${timestamp.getUTCMinutes()}${timestamp.getUTCSeconds()}.json`,
  );
  await exec(
    `docker run --rm -v ${process.cwd()}/liquibase:/liquibase/changelog --network docker-database_default liquibase/liquibase --defaults-file ${propertiesFile} --output-file /liquibase/changelog/current-snapshot.json --snapshot-format=JSON snapshot`,
  );
}

main().catch(err => {
  throw err;
});
