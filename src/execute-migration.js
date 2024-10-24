const path = require('path');

function backupItem(item, scriptFullName, containerName) {
  //lets backup the item prior change.
  const currentScript = path.parse(scriptFullName).name;
  const backupFolder = path.dirname(scriptFullName);
  const backupFileName = `${backupFolder}/backup-[${currentScript}]-${containerName}-id[${item.id}].json`; //to guarantee unique backup name linked to the script. You may have more than one script.
  fs.writeFileSync(backupFileName, JSON.stringify(item));
}

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

  // check if the script has a updateItem method
  if (typeof script.updateItem === 'function') {
    if (!script.query)
      throw new Error('your_srcrip.query is required for updateItem()!');

    // execute the script per item in the container
    const items = await container.items.query(script.query).fetchAll();
    for (const item of items.resources) {
      backupItem(item, scriptPath, script.containerName);
      const updatedItem = script.updateItem(database, container, item);
      try {
        const { resource: replaced } = await container
          .item(updatedItem.id, undefined)
          .replace(updatedItem);
        console.log(`Item with id ${replaced.id} updated`);
      } catch (error) {
        console.error(`Failed to update item with id ${item.id} `);
        console.error(error);
      }
    }
  } else {
    //execute the script for the container
    await script.run(database, container); // Assuming each script has a run method
  }

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

module.exports = { executeMigration };
