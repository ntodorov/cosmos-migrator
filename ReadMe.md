# Introduction

`cosmos-migrator` is a cli tool that will help you to migrate your CosmosDB databases and Containers.

The philosophy behind this tool is borrowed from [dbup](https://dbup.readthedocs.io/en/latest/philosophy-behind-dbup/) and adjusted to fit the CosmosDB world. The main takeaway is "Transitions, not States". This means you do not keep versioned schema of your database, but you keep versioned scripts that will transform your database from one state to another. You also have a Control Table in that database that will keep track of the scripts that were executed, so you can run only the new scripts that you have added. In the CosmosDB world, the Control Table is a document in the collection called `_migrations`. The document has id = '<the collectionName from the script>' and it has a property 'scripts' that is an array of objects that keep the name of the script and when it was executed.

## How to Use `cosmos-migrator`

`cosmos-migrator` is a command-line tool designed to help you manage and apply migrations to your Cosmos DB. Below is a guide on how to use the tool effectively.

### Prerequisites

- **Node.js**: Ensure you have Node.js installed on your machine. You can download it from [here](https://nodejs.org/).
- **Cosmos DB Account**: You need access to a Cosmos DB account with the necessary permissions to perform migrations.

### Installation

First, install `cosmos-migrator` globally using npm:

```bash
npm install -g cosmos-migrator
```

OR use `npx` to run the command:

```bash
npx cosmos-migrator <command> [options]
```

### Usage

The basic syntax for using `cosmos-migrator` is as follows:

```bash
cosmos-migrator <command> [options]
```

### Commands

#### `migrate`

Applies migration scripts to your Cosmos DB.

**Options:**

- `-url, --dbURL <cosmos db endpoint>`  
  _Description_: Specifies the Cosmos DB endpoint URL.  
  _Environment Variable_: `DB_URL`

- `-key, --dbKey <cosmos db key>`  
  _Description_: Specifies the Cosmos DB key.  
  _Environment Variable_: `DB_KEY`

- `-md, --migrationsDir <full folder name>`  
  _Description_: Specifies the directory containing migration scripts.  
  _Environment Variable_: `MIGRATIONS_DIR`

These environment variables can be set in your `.env` file.

**Example Usage:**

1. **Using Command-Line Options**

   ```bash
   cosmos-migrator migrate --dbURL https://your-cosmos-db.documents.azure.com:443/ --dbKey yourCosmosDbKey --migrationsDir ./migrations
   ```

   _Or using shorthand options:_

   ```bash
   cosmos-migrator migrate -url https://your-cosmos-db.documents.azure.com:443/ -key yourCosmosDbKey -md ./migrations
   ```

2. **Using Environment Variables**

   Set the required environment variables:

   ```bash
   export DB_URL=https://your-cosmos-db.documents.azure.com:443/
   export DB_KEY=yourCosmosDbKey
   export MIGRATIONS_DIR=./migrations
   ```

   Then run the migrate command without additional options:

   ```bash
   cosmos-migrator migrate
   ```

   If you prefer not to pass options via the command line, you can set the following environment variables:

   - `DB_URL`: Cosmos DB endpoint URL.
   - `DB_KEY`: Cosmos DB key.
   - `MIGRATIONS_DIR`: Directory containing migration scripts.

#### `validate`

Loads migration files and validates their structure without connecting to Cosmos DB or executing any code.

**Options:**

- `-md, --migrationsDir <full folder name>`
  _Description_: Specifies the directory containing migration scripts to validate.  
  _Environment Variable_: `MIGRATIONS_DIR`

**Example Usage:**

```bash
cosmos-migrator validate --migrationsDir ./migrations

# or using environment variables
export MIGRATIONS_DIR=./migrations
cosmos-migrator validate
```

Validation rules:

- The module must export an object
- Must export `databaseName` (string) and `containerName` (string)
- Must export either `updateItem(item, axios)` or `run(database, container, axios)`
- If `updateItem` is present, a non-empty string `query` export is required
- If both `updateItem` and `run` are present, a warning is emitted (not a failure)

### Migration Scripts

Place your migration scripts in the directory specified by the `--migrationsDir` option or the `MIGRATIONS_DIR` environment variable. Each migration script should handle specific changes to your Cosmos DB schema or data.

#### Migration Script Format

The migration script should be simple java script file that exports several constants and a single funtion.

You can see bellow the needed constants and the function:

```javascript
exports.databaseName = 'StarWars';
exports.containerName = 'jedi';
// NOTE! Create a query with a WHERE clause to limit the items to process!!!
exports.query = 'SELECT * FROM c WHERE c.title = "Master"';
exports.updateItem = function (item, axios) {
  //if possible avoid using if statements here, put the logic in the query!
  item.title = 'Jedi Master';

  // return the updated document! The library will replace the item in the container with this document
  return item;
};
```

#### The `updateItem` function

Will pass you each item that matches the query and you can perform any changes to the item. Before updating the item `cosmos-migrator` will perform a backup of the original item in a file. See the backup section for more details.
After that it will replace the item in the container with the updated by you item.
if you return null from the `updateItem` function, the item will not be updated.

#### The `run` function

If you need to perform a more complex transformation, you can use the `run` function. This function will pass you the database and container objects and you can perform any changes to the database or container.

```javascript
exports.databaseName = 'StarWars';
exports.containerName = 'jedi';

/** You can use the "run" function
 * to execute your migration logic.
 * BUT the update and backup responsibility is yours!!!
 * See the next example for "updateItem" which does both.
 */
exports.run = async function (database, container, axios) {
  console.log('Modifying ref data enactment');

  // just to show how to query. Not real migration - just check for connection. Remove this block
  const { resources: items } = await container.items
    .query('SELECT * FROM c')
    .fetchAll();
  const firstItem = items[0];
  console.log(firstItem);

  return;
  //<< remove to here

  // You could load external JSON
  const jsonData = fs.readFileSync(__dirname + '/jedi-record.json', {
    encoding: 'utf8',
  });
  const document = JSON.parse(jsonData);
  const item = container.item(document.id, undefined);
  console.log("Read item '" + item.id + "'");
  const { resource: readDoc } = await item.read();
  console.log("item with id '" + readDoc.id + "' found");

  // Update the document
  await item.replace(document);
  console.log("item with id '" + item.id + "' replaced");

  console.log('done');
};
```

> :warning: instance of `axios` is passed to the migration script, so you can use it if needed.

## Examples in the `migration-examples` Folder

The `migration-examples` folder contains several example scripts that demonstrate how to use the `cosmos-migrator` effectively:

- **`jedi-record.json`**: This file contains a sample document structure for a Jedi record in CosmosDB. It is an example of schema. The next examples assume that you have a container called `jedi` and a document as `jedi-record.json`.

- **`001-jedi-title-fix.js`**: This example demonstrates how to use the `updateItem` function to update the title of the Jedi.

- **`003-example-external-api-call.js`**: This example demonstrates how to use the `updateItem` function and do an external REST API call.

- **`004-example-for-graphql-api-call.js`**: This example demonstrates how to make a GraphQL API call within a migration script, allowing you to fetch data from an external source and insert it into your CosmosDB.

- **`099-example-of-run-function.js`**: This script showcases how to define a migration function that can be executed to perform specific transformations on your database.

## Use Case Scenarios

- **Schema Changes**: When you need to change the structure of your documents in CosmosDB, you can create migration scripts that will update existing documents to match the new schema.

- **Data Transformation**: If you need to transform data (e.g., changing field names, merging fields, etc.), you can write scripts that will read the current data, apply the transformations, and save the updated documents.

- **Data Migration**: When migrating data from another database or service into CosmosDB, you can use the `cosmos-migrator` to automate the process of inserting and transforming data.

- **Version Control**: By keeping track of executed scripts in the Control Table, you can ensure that your migrations are applied in the correct order and that no scripts are missed during deployment.

By following these guidelines and examples, you can effectively use `cosmos-migrator` to manage your CosmosDB migrations.

## Backup Process

If you use the `updateItem()` function in your migration script, backup will be performed for you.

### How Backup Works

> :warning: **WARNING!** Backup is performed ONLY if you use the `updateItem()` function in your migration script. If you choose to use `run()` instead, you will need to perform the backup yourself.

Before applying any changes to your Cosmos DB items, `cosmos-migrator` performs the following steps to create backups:

1. **Backup Initialization**

   - **Trigger Point**: The backup process is initiated automatically when a migration script includes an `updateItem` method.
   - **Purpose**: To preserve the current state of each item before it undergoes any updates, allowing you to restore the original data if needed.

2. **Generating a Unique Backup Filename**

   Each item to be updated is backed up as an individual JSON file. The backup filename is constructed to ensure uniqueness and traceability. The format of the filename is as follows:

   ```
   backup-[scriptName]-[containerName]-id[itemId].json
   ```

   - **`scriptName`**: Derived from the migration script's filename, ensuring the backup is linked to the specific script that initiated it.
   - **`containerName`**: The name of the Cosmos DB container where the item resides.
   - **`itemId`**: The unique identifier of the Cosmos DB item being backed up.

   _Example Filename:_

   ```
   backup-updateUserSchema-users-id12345.json
   ```

3. **Determining the Backup Directory**

   - The backup files are stored in the same directory as the migration script (`scriptFullName`).
   - This approach keeps backups organized and easily locatable relative to the migration scripts that created them.

4. **Creating the Backup File**

   Utilizing Node.js's `fs` module, the backup process involves writing the item's current state to the backup file in JSON format.

   ```javascript
   const backupFileName = `${backupFolder}/backup-[${currentScript}]-${containerName}-id[${item.id}].json`;
   fs.writeFileSync(backupFileName, JSON.stringify(item));
   ```

   - **`backupFolder`**: The directory path where the backup file will be saved.
   - **`JSON.stringify(item)`**: Converts the Cosmos DB item into a JSON string for storage.

### Accessing and Managing Backups

All backup files generated by `cosmos-migrator` are stored in the migrations directory specified by the `--migrationsDir` option or the `MIGRATIONS_DIR` environment variable. Here's how you can access and manage these backups:

1. **Locating Backup Files**

   Navigate to your migrations directory. Inside, backup files are named systematically, making it easy to identify the relevant backup for any item.

   ```
   ./migrations/
     ├── backup-updateUserSchema-users-id12345.json
     ├── backup-updateUserSchema-users-id67890.json
     └── ...
   ```

2. **Restoring from a Backup**

   If you need to revert an item to its original state, follow these steps:

   - **Locate the Backup File**: Find the corresponding backup file using the item's ID and the migration script's name.
   - **Read the Backup Data**: Load the JSON content from the backup file.
   - **Replace the Item in Cosmos DB**: Use Cosmos DB's SDK to replace the current item with the data from the backup.

   _Example Restoration Process:_

   ```javascript
   const fs = require('fs');
   const { CosmosClient } = require('@azure/cosmos');

   // Initialize Cosmos Client
   const client = new CosmosClient({
     endpoint: process.env.DB_URL,
     key: process.env.DB_KEY,
   });
   const database = client.database('yourDatabaseName');
   const container = database.container('yourContainerName');

   // Read backup file
   const backupData = JSON.parse(
     fs.readFileSync('backup-updateUserSchema-users-id12345.json', 'utf-8')
   );

   // Replace item in Cosmos DB
   container
     .item(backupData.id, backupData.partitionKey)
     .replace(backupData)
     .then(() =>
       console.log(
         `Item with id ${backupData.id} has been restored from backup.`
       )
     )
     .catch((error) =>
       console.error('Error restoring item from backup:', error)
     );
   ```

3. **Managing Backup Files**

   - **Retention**: Determine a retention policy for backup files based on your project's requirements and storage considerations.
   - **Cleanup**: Periodically review and delete unnecessary backup files to free up space and maintain order.
   - **Version Control**: Avoid adding backup files to version control systems like Git to prevent clutter and potential security risks.

### Best Practices

- **Consistent Naming**: The systematic naming convention ensures that backups can be easily matched to their source items and migration scripts.
- **Secure Storage**: Store backup files in a secure location, especially if they contain sensitive data.
- **Regular Backups**: Even though `cosmos-migrator` handles backups during migrations, consider implementing additional backup strategies to cover all bases.
- **Testing Restorations**: Periodically test the restoration process to ensure that backups are valid and can be effectively used when needed.

### Summary

The backup mechanism in `cosmos-migrator` provides a safety net by preserving the state of each Cosmos DB item before any migration-induced changes. By following the structured approach outlined above, you can maintain data integrity, facilitate easy restorations, and ensure a smooth migration experience.
