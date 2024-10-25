jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readdirSync: jest.fn().mockReturnValue(['migration1.js', 'migration2.js']),
}));
const { existsSync, readdirSync } = require('fs');

jest.mock('@azure/cosmos', () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnThis(),
    container: jest.fn().mockReturnThis(),
    containers: {
      createIfNotExists: jest.fn().mockResolvedValue({ container: {} }),
    },
  })),
}));
const CosmosClient = require('@azure/cosmos').CosmosClient;

jest.mock('./execute-migration', () => ({
  executeMigration: jest.fn(),
}));
const { executeMigration } = require('./execute-migration');

const { migrate } = require('./action');

describe('migrate', () => {
  beforeEach(() => {
    // Mock the necessary dependencies and environment variables
    jest.resetModules();
  });

  it('should execute migrations successfully', async () => {
    process.env.DB_URL = 'mock-db-url';
    process.env.DB_KEY = 'mock-db-key';
    process.env.MIGRATIONS_DIR = 'mock-migrations-dir';
    jest.mock('path', () => ({
      resolve: jest.fn().mockReturnValue('mock-migrations-dir'),
      basename: jest.fn().mockReturnValue('migration1.js'),
    }));

    const mockClientInstance = {};
    CosmosClient.mockImplementation(() => mockClientInstance);

    // Call the migrate function
    await migrate({});

    // Assertions
    expect(CosmosClient).toHaveBeenCalledWith({
      endpoint: 'mock-db-url',
      key: 'mock-db-key',
    });
    expect(executeMigration).toHaveBeenCalledTimes(2);

    expect(executeMigration).toHaveBeenNthCalledWith(
      1,
      mockClientInstance,
      expect.stringContaining('mock-migrations-dir/migration1.js')
    );
    expect(executeMigration).toHaveBeenCalledWith(
      mockClientInstance,
      expect.stringContaining('mock-migrations-dir/migration2.js')
    );
  });

  it('should handle missing environment variables', async () => {
    // Mock the necessary functions and objects
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

    existsSync.mockReturnValue(false);

    process.exit = jest.fn();

    process.env.DB_URL = '';
    process.env.DB_KEY = '';
    process.env.MIGRATIONS_DIR = '';

    // Call the migrate function
    await migrate({});

    // Assertions
    expect(mockConsoleError).toHaveBeenCalledTimes(4);
    expect(mockConsoleError).toHaveBeenNthCalledWith(1, 'Errors:');
    expect(mockConsoleError).toHaveBeenNthCalledWith(
      2,
      'Environment var DB_URL or --dbURL option must be provided!'
    );
    expect(mockConsoleError).toHaveBeenNthCalledWith(
      3,
      'Environment var DB_KEY or --dbKey option must be provided!'
    );
    expect(mockConsoleError).toHaveBeenNthCalledWith(
      4,
      'Environment var MIGRATIONS_DIR or --migrationsDir option must be provided and the folder must exist!'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
