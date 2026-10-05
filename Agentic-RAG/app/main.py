from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.api.routes import router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.observability import configure_langsmith
from app.services.audit import init_db


settings = get_settings()
configure_logging()
configure_langsmith(settings)
init_db()

BASE_DIR = Path(__file__).resolve().parents[1]
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

app = FastAPI(title=settings.app_name)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.include_router(router)


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"app_name": settings.app_name, "backend_api_url": settings.backend_api_url},
    )


@app.get("/admin/dashboard")
def admin_dashboard(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"app_name": settings.app_name, "backend_api_url": settings.backend_api_url},
    )


@app.get("/employee/dashboard")
def employee_dashboard(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"app_name": settings.app_name, "backend_api_url": settings.backend_api_url},
    )
