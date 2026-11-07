# Database notes

This folder contains schema inspection scripts for the existing `brandguard_ai_db` database and seed utilities.

## Files
- schema_inspection.sql
- seed_data.sql
- migrations/

## Important
- Do not drop or recreate the existing production database.
- Inspect actual schema before executing statements against live tables.
- Use environment variables in the backend to connect to MySQL.
