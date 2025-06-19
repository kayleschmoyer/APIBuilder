# APIBuilder

APIBuilder is an API generator for SQL Server. It provides a sleek React + Tailwind UI for choosing tables and columns and then generates secure CRUD endpoints complete with OpenAPI documentation.

## Features

- Connects to SQL Server using credentials from `.env`
- Introspects `INFORMATION_SCHEMA` to discover tables and columns
- React interface allows selecting tables, columns and aliases
- Generates versioned RESTful endpoints with JWT or API key security
- Optional rate limiting middleware
- Automatically publishes detailed OpenAPI documentation with Redoc, complete with example payloads
- Saves generated CRUD snippets in the `generated/` folder

## Usage

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and edit it with your SQL Server settings.
3. Start the API server:
   ```bash
   npm start
   ```
    Open `http://localhost:3000/` to launch the builder UI. After generating the API, detailed docs with examples are available at `http://localhost:3000/docs` using Redoc.
    The configuration used is saved under `configs/` and a code snippet for each
    table is written to `generated/`.

## Example

If your database contains a table called `Users` with primary key `UserId`, the generated API exposes endpoints such as:

- `GET /api/v1/Users` – list all users
- `GET /api/v1/Users/:id` – get a single user
- `POST /api/v1/Users` – create a user
- `PUT /api/v1/Users/:id` – update a user
- `DELETE /api/v1/Users/:id` – delete a user

All routes require authentication via JWT in the `Authorization` header or an API key in `x-api-key`.

## Notes

- Only tables with primary keys are exposed.
- Column and table names are validated to mitigate SQL injection.
