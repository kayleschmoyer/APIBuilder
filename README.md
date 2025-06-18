# APIBuilder

APIBuilder is a simple tool that generates REST APIs for SQL Server tables. It includes a small web interface so you can pick exactly which tables and columns you want to expose.

## Features

- Connects to a local or remote SQL Server instance using a connection pool.
- Inspects `INFORMATION_SCHEMA` to find all tables and columns.
- Web UI allows choosing tables and columns to expose.
- Generates CRUD endpoints (list, get by id, create, update, delete) for the selected tables.
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

   Then open `http://localhost:3000/admin` in your browser. Select the tables and
   columns you want and click **Generate API**. Endpoints will be created on the
   fly for your selections.

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

