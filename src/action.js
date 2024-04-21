const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Execute a migration script
async function executeMigration(client, scriptPath) {
  //load the migration script
  const script = require(scriptPath);

  const database = client.database(script.databaseName);
  //connect to the container that the migration script is targeting
  const container = database.container(script.containerName);
  //connect to the dedicated for MIGRATIONS container
  const { container: migrationsContainer } =
    await database.containers.createIfNotExists({ id: '_migrations' });

  //load the migration history for this container
  const scriptName = path.basename(scriptPath);
  const migrationHistory = migrationsContainer.item(
    script.containerName,
    undefined
  );
  const { resource: migrations } = await migrationHistory.read();

  //check if the script was already executed
  const executedOn = migrations?.scripts?.find(
    (script) => script.scriptName === scriptName
  )?.executedOn;

  //if it was already executed, skip it
  if (executedOn) {
    console.log(
      `Skipping migration: ${scriptName}. It was previously executed on "${executedOn}".`
    );
    return;
  }

  //MAIN WORK HERE: execute the script
  await script.run(database, container); // Assuming each script has a run method

  //record the execution in the migration history
  if (migrations)
    migrations.scripts.push({
      scriptName,
      executedOn: new Date().toISOString(),
    });

  const migrationItem = migrations ?? {
    id: script.containerName,
    scripts: [{ scriptName, executedOn: new Date().toISOString() }],
  };
  //save the migration history
  await migrationsContainer.items.upsert(migrationItem);
}

async function migrate(options) {
  dotenv.config();

  const endpoint = options.dbURL || process.env.DB_URL;
  const key = options.dbKey || process.env.DB_KEY;
  const migrationsDir = path.resolve(
    process.cwd(),
    options.migrationsDir || process.env.MIGRATIONS_DIR
  );

  const errors = [];
  if (!endpoint)
    errors.push('Environment var DB_URL or --dbURL option must be provided!');
  if (!key)
    errors.push('Environment var DB_KEY or --dbKey option must be provided!');
  if (!fs.fileExistsSync(migrationsDir))
    errors.push(
      'Environment var MIGRATIONS_DIR or --migrationsDir option must be provided and the folder must exist!'
    );
  if (errors.length > 0) {
    console.error('Errors:');
    errors.forEach((err) => console.error(err));
    process.exit(1);
  }

  console.log('Starting migrations execution.');
  // Connect to Cosmos
  const client = new CosmosClient({ endpoint, key });

  //load all migration files
  let migrationFiles = fs.readdirSync(migrationsDir).sort();

  if (migrationFiles.length === 0) {
    console.log('No migrations to execute.');
    return;
  }

  //remove non js files
  migrationFiles = migrationFiles.filter((file) => file.endsWith('.js'));
  //throw error if there are more than 200 migrations
  if (migrationFiles.length > 200)
    throw new Error(
      'You have more than 200 migrations. Please reset your migration history and delete the old migration files.'
    );

  //log warining if the migrations are more than 100
  if (migrationFiles.length > 100)
    console.warn(
      'You have more than 100 migrations. Consider resetting your migration history and deleting the old migration files. Max allowed is 200.'
    );

  try {
    //execute all migrations
    for (let file of migrationFiles) {
      console.log(`Executing migration: ${file}`);
      await executeMigration(client, `${migrationsDir}/${file}`);
    }
    console.log('Executing migrations done.');
  } catch (error) {
    console.error('Error executing migrations:');
    console.error(error);
    process.exit(1);
  }
}

module.exports = { migrate };
