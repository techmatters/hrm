const util = require('util');
const exec = util.promisify(require('child_process').exec);
/* eslint-disable-next-line import/no-extraneous-dependencies */
const yargs = require('yargs');

async function main() {
  const args = yargs(process.argv.slice(2))
    .command(
      '$0',
      'Updates your local dev DB to the latest version as specified in the Liquibase changelog',
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
    `docker run --rm -v ${process.cwd()}/liquibase:/liquibase/changelog --network docker-database_default liquibase/liquibase --defaults-file ${propertiesFile} update`,
  );
}

main().catch(err => {
  throw err;
});
