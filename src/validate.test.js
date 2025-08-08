const fs = require('fs');
const os = require('os');
const path = require('path');

describe('validate command', () => {
  const examplesDir = path.resolve(__dirname, '../migration-examples');

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    delete process.env.MIGRATIONS_DIR;
  });

  it('should validate example migrations successfully', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    const { validate } = require('./validate');
    await validate({ migrationsDir: examplesDir });

    expect(exitSpy).not.toHaveBeenCalledWith(1);
    const logOutput = logSpy.mock.calls.flat().join('\n');
    expect(logOutput).toMatch(/Validation successful\./);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should fail validation for invalid script structure', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmos-migrator-'));
    const invalidScriptPath = path.join(tmpRoot, '001-invalid.js');
    fs.writeFileSync(invalidScriptPath, "exports.containerName = 'test';\n");

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    const { validate } = require('./validate');
    await validate({ migrationsDir: tmpRoot });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const errorOutput = errorSpy.mock.calls.flat().join('\n');
    expect(errorOutput).toMatch(
      /Missing or invalid required export: databaseName/
    );
    expect(errorOutput).toMatch(
      /Script must export either updateItem\(item, axios\) or run\(database, container, axios\) function\./
    );
  });

  it('should use MIGRATIONS_DIR env var when option not provided', async () => {
    process.env.MIGRATIONS_DIR = examplesDir;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    const { validate } = require('./validate');
    await validate({});

    expect(exitSpy).not.toHaveBeenCalledWith(1);
    const logOutput = logSpy.mock.calls.flat().join('\n');
    expect(logOutput).toMatch(/Validation successful\./);
  });
});
