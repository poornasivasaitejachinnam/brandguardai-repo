# Documentation

This project includes a React frontend, an Express API layer and a Python FastAPI compliance service.

The backend is the only service that directly connects to MySQL. The FastAPI service receives analysis requests over HTTP and returns structured evaluation results.

## Important notes
- Update backend/.env and frontend/.env before running against a real database.
- Database inspection scripts are located under database/.
- This project is built to be run locally on Windows CMD.
