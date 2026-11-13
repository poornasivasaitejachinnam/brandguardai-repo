# BrandGuard AI Database

This directory contains the database schema, reference seed data, and schema inspection scripts for the `brandguard_ai_db` MySQL database.

## Files
- `schema.sql`: Full, idempotent database schema definition (all 25 tables, primary keys, indexes, foreign keys, and seed reference data). Safe for initializing a new laptop or testing environment.
- `schema_inspection.sql`: Read-only queries against `INFORMATION_SCHEMA` to verify tables and constraints.
- `seed_data.sql`: Seed placeholders and validation queries.
- `migrations/`: Future incremental database migrations.

## Setting Up MySQL on a New Laptop

### Step 1: Install & Start MySQL Server
Ensure MySQL 8.0+ is installed and running locally on port 3306.

### Step 2: Import the Schema
Run the following command from the project root using MySQL CLI (replace `root` with your MySQL username):

```bash
mysql -u root -p < database/schema.sql
```

Alternatively, open `database/schema.sql` in MySQL Workbench or your preferred database client and execute the script.

The script uses `CREATE DATABASE IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, and `INSERT IGNORE`, making it safe and idempotent:
- It creates the `brandguard_ai_db` database if missing.
- It creates all 25 application tables with their indexes and foreign key constraints.
- It inserts default seed records for roles (`admin`, `content_creator`, `reviewer`), content categories, and system settings.
- It **never** drops existing tables and **never** deletes existing user data.

### Step 3: Configure Backend Environment
Copy `backend/.env.example` to `backend/.env` and update the database credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=brandguard_ai_db
```

### Step 4: Bootstrap an Initial Administrator
To create the first platform administrator on a fresh installation:
```bash
cd backend
npm run bootstrap:admin
```
