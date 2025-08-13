const path = require('path');
const fs = require('fs');
//making sure axios installed and available
const axios = require('axios');
const PRECONDITION_FAILED = 412;
function backupItem(item, scriptFullName, containerName) {
  //lets backup the item prior change.
  const currentScript = path.parse(scriptFullName).name;
  const backupFolder = path.dirname(scriptFullName);
  const backupFileName = `${backupFolder}/backup-[${currentScript}]-${containerName}-id[${item.id}].json`; //to guarantee unique backup name linked to the script. You may have more than one script.
  fs.writeFileSync(backupFileName, JSON.stringify(item));
}

async function getPartitionKeyPaths(container) {
  const { resource: containerDefinition } = await container.read();
  const paths = containerDefinition.partitionKey?.paths || [];
  return paths.map((p) => p.replace(/^\//, ''));
}

function getValueAtPath(objectWithData, pathExpression) {
  return pathExpression
    .split('/')
    .reduce(
      (current, key) => (current == null ? undefined : current[key]),
      objectWithData
    );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateItemWithRetry({
  container,
  script,
  originalItem,
  getPartitionKeyValue,
  scriptPath,
  containerName,
  axiosInstance,
  maxRetries = 5,
  baseDelayMs = 100,
}) {
  let attempt = 0;
  let didBackup = false;
  const partitionKeyValue = getPartitionKeyValue(originalItem);
  let currentItem = originalItem;

  while (attempt < maxRetries) {
    try {
      const updatedItem = await script.updateItem(currentItem, axiosInstance);
      if (updatedItem === null) {
        console.log(
          `[cosmos-migrator] Skipping item with id ${originalItem.id} because the updateItem() returned null`
        );
        return false;
      }

      if (!didBackup) {
        backupItem(originalItem, scriptPath, containerName);
        didBackup = true;
      }

      const { resource: replaced } = await container
        .item(updatedItem.id, partitionKeyValue)
        .replace(updatedItem, { ifMatch: currentItem._etag });
      console.log(`Item with id ${replaced.id} updated`);
      return true;
    } catch (error) {
      const status = error?.statusCode ?? error?.code;
      const codeStr = typeof error?.code === 'string' ? error.code : '';
      const isPreconditionFailed =
        status === PRECONDITION_FAILED || codeStr === 'PreconditionFailed';

      if (!isPreconditionFailed) {
        console.error(
          `[cosmos-migrator] Failed to update item with id ${originalItem.id} `
        );
        console.error(error);
        throw error;
      }

      attempt++;
      if (attempt >= maxRetries) {
        console.error(
          `[cosmos-migrator] Max retries reached for item with id ${originalItem.id} due to concurrent updates.`
        );
        throw error;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      await delay(delayMs);

      // Read the latest version and retry transformation
      const { resource: fresh } = await container
        .item(originalItem.id, partitionKeyValue)
        .read();
      currentItem = fresh;
    }
  }

  return false;
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

    const partitionKeyPaths = await getPartitionKeyPaths(container);
    const getPartitionKeyValue = (doc) =>
      partitionKeyPaths.length <= 1
        ? getValueAtPath(doc, partitionKeyPaths[0] || '')
        : partitionKeyPaths.map((p) => getValueAtPath(doc, p));
    // execute the script per item in the container
    const items = await container.items.query(script.query).fetchAll();
    for (const item of items.resources) {
      const originalItem = JSON.parse(JSON.stringify(item));
      try {
        const updated = await updateItemWithRetry({
          container,
          script,
          originalItem,
          getPartitionKeyValue,
          scriptPath,
          containerName: script.containerName,
          axiosInstance: axios,
        });
        if (!updated) continue;
      } catch (error) {
        throw error;
      }
    }
  } else {
    //execute the script for the container
    await script.run(database, container, axios);
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
