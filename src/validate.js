const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function validateScriptStructure(script, scriptFileName) {
  const errors = [];

  if (!script || typeof script !== 'object') {
    errors.push('Module did not export an object.');
    return errors;
  }

  if (!script.databaseName || typeof script.databaseName !== 'string') {
    errors.push('Missing or invalid required export: databaseName (string).');
  }

  if (!script.containerName || typeof script.containerName !== 'string') {
    errors.push('Missing or invalid required export: containerName (string).');
  }

  const hasUpdateItem = typeof script.updateItem === 'function';
  const hasRun = typeof script.run === 'function';

  if (!hasUpdateItem && !hasRun) {
    errors.push(
      'Script must export either updateItem(item, axios) or run(database, container, axios) function.'
    );
  }

  if (hasUpdateItem) {
    if (
      !script.query ||
      typeof script.query !== 'string' ||
      script.query.trim() === ''
    ) {
      errors.push(
        'When updateItem() is exported, a non-empty string export "query" is required.'
      );
    }
  }

  if (hasUpdateItem && hasRun) {
    // Not an error, but warn the user that updateItem will take precedence during execution
    // Consumers of this function may surface warnings; here we just annotate the error list with a warning prefix
    errors.push(
      '[warning] Both updateItem() and run() are exported. updateItem() takes precedence during execution.'
    );
  }

  return errors;
}

async function validate(options) {
  dotenv.config();

  const migrationsDir = path.resolve(
    process.cwd(),
    options.migrationsDir || process.env.MIGRATIONS_DIR || ''
  );

  const errors = [];
  if (!fs.existsSync(migrationsDir)) {
    errors.push(
      'Environment var MIGRATIONS_DIR or --migrationsDir option must be provided and the folder must exist!'
    );
  }
  if (errors.length > 0) {
    console.error('Errors:');
    errors.forEach((err) => console.error(err));
    process.exit(1);
  }

  let migrationFiles = fs.readdirSync(migrationsDir).sort();
  migrationFiles = migrationFiles.filter((fileName) =>
    fileName.endsWith('.js')
  );

  if (migrationFiles.length === 0) {
    console.log('No .js migration files found to validate.');
    return;
  }

  const allErrors = [];

  for (const fileName of migrationFiles) {
    const fullPath = path.join(migrationsDir, fileName);

    try {
      // Clear require cache to ensure we load fresh code if validate is run multiple times in the same process
      delete require.cache[require.resolve(fullPath)];
      const scriptModule = require(fullPath);
      const scriptErrors = validateScriptStructure(scriptModule, fileName);

      if (scriptErrors.length > 0) {
        allErrors.push({ fileName, errors: scriptErrors });
      }
    } catch (err) {
      allErrors.push({
        fileName,
        errors: [`Failed to load script: ${err?.message || String(err)}`],
      });
    }
  }

  if (allErrors.length > 0) {
    let hasHardErrors = false;
    console.error('Validation completed with issues:');
    for (const issue of allErrors) {
      console.error(`- ${issue.fileName}`);
      for (const err of issue.errors) {
        console.error(`  - ${err}`);
        if (!String(err).startsWith('[warning]')) hasHardErrors = true;
      }
    }
    if (hasHardErrors) process.exit(1);
    return;
  }

  console.log(
    `Validation successful. ${migrationFiles.length} migration scripts validated.`
  );
}

module.exports = { validate };
