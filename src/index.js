#!/usr/bin/env node

const { Command } = require('commander');

const packageJson = require('../package.json');
const { migrate } = require('./action');
const { validate } = require('./validate');

//get command line arguments
const program = new Command();
program
  .name('cosmos-migrator')
  .description(packageJson.description)
  .version(packageJson.version);

program
  .command('migrate')
  .option(
    '-url, --dbURL <cosmos db endpoint>',
    'Cosmos DB endpoint URL. Can also be set in the environment variable DB_URL'
  )
  .option(
    '-key, --dbKey <cosmos db key>',
    'Cosmos DB key. Can also be set in the environment variable DB_KEY'
  )
  .option(
    '-md, --migrationsDir <full folder name>',
    'Folder containing the migration scripts. Can also be set in the environment variable MIGRATIONS_DIR'
  )
  .option(
    '-ude, --useDotEnv',
    'DEPRICATED! Now the cli will always check for environment variables in a .env file. '
  )
  .action(migrate);

program
  .command('validate')
  .option(
    '-md, --migrationsDir <full folder name>',
    'Folder containing the migration scripts to validate. Can also be set in the environment variable MIGRATIONS_DIR'
  )
  .description('Validate migration scripts without executing them')
  .action(validate);

program.parse();
