import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config(); // Load the .env file

// This helper function checks if a variable exists, and if not, throws a clear error.
function getEnv(key: string): string {
  const value = process.env[key];
  if (typeof value === 'undefined') {
    throw new Error(
      `Environment variable ${key} is not set. Please check your .env file.`,
    );
  }
  return value;
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: getEnv('DB_HOST'),
  port: parseInt(getEnv('DB_PORT'), 10),
  username: getEnv('DB_USERNAME'),
  password: getEnv('DB_PASSWORD'),
  database: getEnv('DB_DATABASE'),
  entities: ['src/**/*.entity.ts'],
  migrations: ['dist/migration/*.js'],
  logging: true,
  synchronize: false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
