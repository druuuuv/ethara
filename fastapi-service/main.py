import os
import csv
import io
import jwt  # type: ignore
import psycopg2  # type: ignore
import psycopg2.extras  # type: ignore
from datetime import datetime
from dotenv import load_dotenv  # type: ignore
from fastapi import FastAPI, HTTPException, Depends, Request  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from fastapi.responses import StreamingResponse  # type: ignore

load_dotenv()

app = FastAPI(title="Ethara Analytics Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/ethara")
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-this")


def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()


async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")
    token = auth.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload["userId"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ethara-analytics", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/analytics/project-summary")
def project_summary(user_id: str = Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("""
        SELECT p.id, p.name, p.color,
            COUNT(t.id) as total_tasks,
            COUNT(CASE WHEN t.status='todo' THEN 1 END) as todo,
            COUNT(CASE WHEN t.status='in_progress' THEN 1 END) as in_progress,
            COUNT(CASE WHEN t.status='done' THEN 1 END) as done,
            COUNT(CASE WHEN t.due_date < CURRENT_DATE AND t.status!='done' THEN 1 END) as overdue,
            CASE WHEN COUNT(t.id)>0 THEN ROUND(COUNT(CASE WHEN t.status='done' THEN 1 END)*100.0/COUNT(t.id),1) ELSE 0 END as completion_rate
        FROM projects p LEFT JOIN tasks t ON p.id=t.project_id
        GROUP BY p.id, p.name, p.color ORDER BY p.name
    """)
    return {"projects": cur.fetchall()}


@app.get("/api/analytics/user-workload")
def user_workload(user_id: str = Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("""
        SELECT u.id, u.name, u.avatar_color,
            COUNT(t.id) as total_tasks,
            COUNT(CASE WHEN t.status='todo' THEN 1 END) as todo,
            COUNT(CASE WHEN t.status='in_progress' THEN 1 END) as in_progress,
            COUNT(CASE WHEN t.status='done' THEN 1 END) as done,
            COUNT(CASE WHEN t.due_date < CURRENT_DATE AND t.status!='done' THEN 1 END) as overdue
        FROM users u LEFT JOIN tasks t ON u.id=t.assigned_to
        GROUP BY u.id, u.name, u.avatar_color ORDER BY total_tasks DESC
    """)
    return {"users": cur.fetchall()}


@app.get("/api/analytics/overdue-report")
def overdue_report(user_id: str = Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("""
        SELECT t.id, t.title, t.due_date, t.priority, t.status,
            p.name as project_name, u.name as assignee_name,
            CURRENT_DATE - t.due_date as days_overdue
        FROM tasks t JOIN projects p ON t.project_id=p.id LEFT JOIN users u ON t.assigned_to=u.id
        WHERE t.due_date < CURRENT_DATE AND t.status != 'done'
        ORDER BY t.due_date ASC
    """)
    return {"tasks": cur.fetchall()}


@app.get("/api/analytics/export/tasks")
def export_tasks(user_id: str = Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("""
        SELECT t.title, t.description, t.status, t.priority, t.due_date,
            p.name as project, u.name as assignee, c.name as created_by, t.created_at
        FROM tasks t JOIN projects p ON t.project_id=p.id
        LEFT JOIN users u ON t.assigned_to=u.id JOIN users c ON t.created_by=c.id
        ORDER BY p.name, t.created_at DESC
    """)
    rows = cur.fetchall()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["title","description","status","priority","due_date","project","assignee","created_by","created_at"])
    writer.writeheader()
    for row in rows:
        row_dict = dict(row)
        for k, v in row_dict.items():
            if isinstance(v, datetime):
                row_dict[k] = v.isoformat()
            elif hasattr(v, 'isoformat'):
                row_dict[k] = v.isoformat()
        writer.writerow(row_dict)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ethara_tasks_export.csv"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
