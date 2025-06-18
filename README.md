# APIBuilder

APIBuilder is a simple tool that automatically generates a REST API for all tables in a SQL Server database.

## Features

- Connects to a local or remote SQL Server instance using a connection pool.
- Inspects `INFORMATION_SCHEMA` to find all tables and their primary keys.
- Generates CRUD endpoints for every table (list, get by id, create, update, delete).
- Uses parameterized queries for all data access to avoid SQL injection.
- Runs as an Express application on Node.js.

## Usage

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set environment variables or edit `server.js` for connection details:

   - `DB_USER` – SQL Server username (default `sa`)
   - `DB_PASSWORD` – password
   - `DB_SERVER` – host name or IP (default `localhost`)
   - `DB_NAME` – database name (default `master`)
   - `PORT` – port for the HTTP server (default `3000`)

   These can be placed in a `.env` file or supplied by your environment.

3. Start the API server:

   ```bash
   npm start
   ```

   The server will introspect the database and create endpoints for each table.

## Example

If your database contains a table called `Users` with primary key `UserId`, the server will expose endpoints like:

- `GET /Users` – list all users
- `GET /Users/:UserId` – get a single user
- `POST /Users` – create a user (fields in JSON body)
- `PUT /Users/:UserId` – update a user
- `DELETE /Users/:UserId` – delete a user

The same pattern applies to all other tables that have primary keys defined.

## Notes

- Only tables with primary keys are exposed for safety. Tables without primary keys are skipped.
- Column and table names are validated to contain only letters, numbers and underscores to mitigate SQL injection risks.
- This project intentionally avoids database-specific features beyond standard SQL so that it works with any SQL Server edition.

