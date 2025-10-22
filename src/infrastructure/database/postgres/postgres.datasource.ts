import { DataSource } from 'typeorm';
// import { UserEntity } from '../../../domain/user.entity';

export const PostgresDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  //   entities: [UserEntity],
  synchronize: true,
});
