# 🚀 Ethara — Team Task Manager (Full-Stack)

A full-stack web application where teams can **create projects**, **assign tasks**, and **track progress** with **role-based access control** (Admin / Member).

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)

---

## ✨ Key Features

- **Authentication** — Signup & Login with JWT tokens
- **Role-Based Access Control** — Admin and Member roles
  - **Admin**: Create/delete projects, create/assign/delete tasks, add team members
  - **Member**: View assigned projects, update task status on their tasks
- **Project Management** — Create projects, add team members, set colors
- **Task Management** — Create tasks with priority (low/medium/high), assign to users, set due dates, track status (todo → in_progress → done)
- **Dashboard** — Real-time overview: total tasks, completed, in-progress, overdue count, recent tasks, overdue report
- **Analytics Service** — FastAPI microservice for advanced project analytics and CSV export

---

## 🏗️ Architecture

```
ethara/
├── backend/           # Node.js + Express API (Port 5000)
│   ├── routes/        # auth, projects, tasks, users, dashboard
│   ├── middleware/     # JWT auth, RBAC middleware
│   └── db/            # PostgreSQL pool, schema, init
├── fastapi-service/   # Python FastAPI Analytics (Port 8000)
│   └── main.py        # Analytics endpoints, CSV export
└── frontend/          # React + Vite + TypeScript (Port 5173)
    ├── src/pages/      # Dashboard, Projects, Tasks, Login, Register
    ├── src/components/ # Layout, Sidebar
    └── src/context/    # AuthContext (JWT state management)
```

---

## 🛠️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 19, Vite, TypeScript          |
| Backend    | Node.js, Express, JWT, bcryptjs     |
| Analytics  | Python, FastAPI, PyJWT              |
| Database   | PostgreSQL                          |
| Deployment | Railway                             |

---

## 🚀 Getting Started (Local)

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL running locally

### 1. Clone & Setup Database
```bash
# Create database
createdb ethara

# Initialize schema
cd backend
cp .env.example .env     # Edit with your DB credentials
npm install
npm run db:init
```

### 2. Start Backend
```bash
cd backend
npm start                # Runs on port 5000
```

### 3. Start Analytics Service
```bash
cd fastapi-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev              # Runs on port 5173
```

Visit **http://localhost:5173** and create an account!

---

## 🔑 Environment Variables

### Backend (`backend/.env`)
```
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/ethara
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
```

### FastAPI (`fastapi-service/.env`)
```
PORT=8000
DATABASE_URL=postgresql://postgres:password@localhost:5432/ethara
JWT_SECRET=your-super-secret-jwt-key-change-this
FRONTEND_URL=http://localhost:5173
```

---

## 📡 API Endpoints

### Auth
| Method | Endpoint          | Description          | Access  |
|--------|-------------------|----------------------|---------|
| POST   | `/api/auth/signup` | Register new user    | Public  |
| POST   | `/api/auth/login`  | Login & get JWT      | Public  |
| GET    | `/api/auth/me`     | Get current user     | Auth    |

### Projects
| Method | Endpoint                          | Description          | Access       |
|--------|-----------------------------------|----------------------|--------------|
| GET    | `/api/projects`                   | List projects        | Auth         |
| POST   | `/api/projects`                   | Create project       | Admin only   |
| PUT    | `/api/projects/:id`               | Update project       | Admin        |
| DELETE | `/api/projects/:id`               | Delete project       | Admin only   |
| POST   | `/api/projects/:id/members`       | Add member           | Admin        |
| DELETE | `/api/projects/:id/members/:uid`  | Remove member        | Admin        |

### Tasks
| Method | Endpoint                    | Description          | Access       |
|--------|-----------------------------|----------------------|--------------|
| GET    | `/api/tasks`                | List all tasks       | Auth         |
| GET    | `/api/tasks/project/:id`    | Tasks by project     | Auth         |
| POST   | `/api/tasks`                | Create task          | Admin        |
| PUT    | `/api/tasks/:id`            | Update task          | Admin/Owner  |
| PATCH  | `/api/tasks/:id/status`     | Change status        | Admin/Owner  |
| DELETE | `/api/tasks/:id`            | Delete task          | Admin        |

### Dashboard
| Method | Endpoint              | Description          | Access  |
|--------|-----------------------|----------------------|---------|
| GET    | `/api/dashboard`      | Stats + recent tasks | Auth    |
| GET    | `/api/dashboard/overdue` | Overdue tasks     | Auth    |

---

## 🌐 Deployment (Railway)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) and create a new project
3. Add services:
   - **PostgreSQL** — Railway provides managed PostgreSQL
   - **Backend** — Point to `/backend` directory, set env vars
   - **Frontend** — Point to `/frontend` directory, set `VITE_API_URL` to backend URL
4. Set environment variables on each service
5. Deploy!

---

## 📄 License

MIT
