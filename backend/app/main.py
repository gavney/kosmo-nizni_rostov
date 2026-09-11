from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router as calc_router
from .fixtures import router as fixtures_router
from .variants_api import router as variants_router

app = FastAPI(title="Polar Mesh", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(fixtures_router, prefix="/api")
app.include_router(calc_router, prefix="/api")
app.include_router(variants_router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "polar-mesh"}
