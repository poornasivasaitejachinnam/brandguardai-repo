# BrandGuard AI

BrandGuard AI is an enterprise-ready brand governance platform built with React, Express, MySQL, and a FastAPI AI compliance service.

This repository is fully configured for both single-device development and **multi-device LAN access** (running on one host laptop and accessing or running across other laptops on the same local network).

---

## Architecture & Port Allocation

| Component | Technology | Default Port | Network Host | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | React + Vite | `5173` | `0.0.0.0` | Client web interface with automatic LAN API discovery |
| **Backend** | Node.js + Express | `5000` | `0.0.0.0` | Core REST API, JWT auth, business logic, MySQL controller |
| **AI Service** | Python FastAPI | `8000` | `0.0.0.0` | Compliance engine, rule checks, recommendation service |
| **Database** | MySQL 8.0+ | `3306` | `localhost` | Secure relational storage (internal to backend host only) |

---

## 1. Prerequisites & Required Software

Make sure the following software is installed on the host machine (and on any developer laptop running the services):

1. **Node.js**: v18.x or v20.x+ (includes `npm`)
   - Check version: `node -v` and `npm -v`
2. **Python**: v3.10+ (recommended v3.11 or v3.12)
   - Check version: `python --version`
3. **MySQL Server**: v8.0 or higher
   - Check status: `mysql --version`
4. **Git** (optional, for version control)

> **Windows Note (Zip Transfers):** If you extracted this project from a downloaded ZIP archive, Windows may mark files with the Mark-of-the-Web (Zone.Identifier), which can block script execution. Unblock the project directory in PowerShell before running:
> ```powershell
> Get-ChildItem -Recurse | Unblock-File
> ```

---

## 2. Dependency Installation

### Frontend
```bash
cd frontend
npm install
```

### Backend
```bash
cd backend
npm install
```

### AI Service (Python FastAPI)
On Windows:
```cmd
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

On macOS / Linux:
```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 3. Database Setup & Portability

The database schema and reference data are self-contained in `database/schema.sql`.

### Setting up MySQL on a New Laptop:
1. Ensure your local MySQL server is running on port `3306`.
2. Open PowerShell or Command Prompt in the project root and import the schema:
   ```cmd
   mysql -u root -p < database\schema.sql
   ```
   *(Or open `database/schema.sql` in MySQL Workbench and execute all statements).*
3. The script is **safe and idempotent**:
   - Creates `brandguard_ai_db` if not exists.
   - Creates all 25 tables with keys and foreign constraints.
   - Inserts reference roles (`admin`, `content_creator`, `reviewer`), categories, and system settings using `INSERT IGNORE`.
   - Never deletes or modifies existing data.

---

## 4. Environment Configuration

### Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```env
# By default, the frontend automatically discovers the host's backend at window.location.hostname:5000/api
# This works seamlessly whether accessing via localhost or LAN IP (e.g. 192.168.1.6).
VITE_API_URL=http://localhost:5000/api
```

### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` and update your MySQL password and JWT secret:
```env
PORT=5000
HOST=0.0.0.0
CORS_ORIGIN=*

# Database Connection
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=brandguard_ai_db

# Security & AI Service
JWT_SECRET=replace_with_a_secure_random_secret
AI_SERVICE_URL=http://localhost:8000
```

### AI Service (`ai-service/.env`)
*(Optional, default is 0.0.0.0:8000)*
```env
AI_SERVICE_HOST=0.0.0.0
AI_SERVICE_PORT=8000
```

---

## 5. Starting the Services

### Option A: One-Click Startup Script (Windows)
Double-click `scripts\start-all.bat` or run:
```powershell
.\scripts\start-all.ps1
```
This automatically launches all three services in separate windows and prints your host laptop's LAN IP address.

### Option B: Manual Startup in 3 Terminals

#### Terminal 1 — Python FastAPI AI Service:
```cmd
cd ai-service
.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Terminal 2 — Node.js Express Backend:
```cmd
cd backend
npm run dev
```

#### Terminal 3 — React Vite Frontend:
```cmd
cd frontend
npm run dev
```

---

## 6. Accessing the Application from Another Laptop

To access the platform from another laptop on the same local network:

### Step 1: Find the Host Laptop's LAN IPv4 Address
On the host laptop (where the servers are running), open PowerShell and run:
```powershell
ipconfig
```
Look for **Wireless LAN adapter Wi-Fi** (or **Ethernet adapter**) and find the **IPv4 Address**, e.g.:
```
IPv4 Address. . . . . . . . . . . : 192.168.1.6
```

### Step 2: Configure Windows Firewall on Host Laptop
Allow inbound traffic on ports `5173` (Frontend) and `5000` (Backend). Run PowerShell as **Administrator**:
```powershell
New-NetFirewallRule -DisplayName "BrandGuard Frontend (5173)" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "BrandGuard Backend (5000)" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "BrandGuard AI Service (8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```
*(Notice: Database port `3306` is kept internal to the host machine for security and is NOT opened).*

### Step 3: Connect Both Laptops to the Same Network
Ensure both laptops are connected to the same Wi-Fi router or LAN subnet.

### Step 4: Open in Web Browser on the Second Laptop
On the second laptop, open any web browser (Chrome, Edge, Firefox) and navigate to:
```
http://<HOST_IP>:5173
```
*Example:* `http://192.168.1.6:5173`

The frontend will load and dynamically communicate with the backend API at `http://192.168.1.6:5000/api`.

---

## 7. Testing & Verification

### Verify Health Endpoints
From any laptop on the network, verify the backend and AI service health:
- Backend Health: `http://<HOST_IP>:5000/health` (returns `{"status":"ok"}`)
- Database Health: `http://<HOST_IP>:5000/health/db` (returns `{"status":"ok","database":"connected"}`)
- AI Service Health: `http://<HOST_IP>:8000/` (returns `{"service":"BrandGuard AI Service","status":"online"}`)

### Run Automated Smoke Tests
With the services running, run the following tests in `backend/`:
```bash
cd backend
npm run test:smoke
npm run test:workflow
```

### Administrator Bootstrap
If setting up a fresh database without users, create your first admin user:
```bash
cd backend
npm run bootstrap:admin
```

---

## 8. Troubleshooting & Common Issues

| Issue / Error | Cause | Resolution |
| :--- | :--- | :--- |
| **ERR_CONNECTION_REFUSED** on other laptop | Firewall blocking port, or host IP changed | 1. Verify host IP via `ipconfig`.<br>2. Run the Windows Firewall commands in Section 6.<br>3. Verify all 3 terminals are actively running. |
| **CORS error** in browser console | Frontend origin rejected by backend | Ensure `CORS_ORIGIN=*` is in `backend/.env`. Our dynamic CORS handler automatically accepts local network origins. |
| **MySQL connection error (ECONNREFUSED / ER_ACCESS_DENIED_ERROR)** | MySQL is not running or credentials incorrect | 1. Ensure MySQL service is running (`net start MySQL80`).<br>2. Verify `DB_USER` and `DB_PASSWORD` in `backend/.env`. |
| **Unknown database 'brandguard_ai_db'** | Database has not been created on this laptop | Import `database/schema.sql` via `mysql -u root -p < database/schema.sql`. |
| **Uploaded file links fail to open** | Hardcoded localhost reference | Verify `frontend/src/services/api.js` uses `getBackendBaseUrl()` (included in latest update). |
| **AI analysis timeout or fails** | AI service not running on port 8000 | Ensure `uvicorn app.main:app --host 0.0.0.0 --port 8000` is active and reachable at `http://<HOST_IP>:8000/`. |
