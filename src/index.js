#!/usr/bin/env node

const { Command } = require('commander');

const packageJson = require('../package.json');
const { migrate } = require('./action');

//get command line arguments
const program = new Command();
program
  .name('cosmos-migrator')
  .description(packageJson.description)
  .version(packageJson.version);

program
  .command('migrate')
  .option(
    '-ude, --useDotEnv',
    'Use environment variables defined in a .env file instead of command line arguments'
  )
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
  .action(migrate);

program.parse();
