"""HTTP adapter for the dictionary; also serves the built React application."""

from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path
import tempfile

from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .db import DictionaryBuilder
from .db.dictionary_database import ensure_usage_ranks
from .dictionary import SearchMode, search_dictionary

BACKEND_ROOT = Path(__file__).resolve().parents[1]


class DictionaryEntry(BaseModel):
    character: str
    pinyin: str
    gloss: str | None
    codepoint: str | None


class SearchResponse(BaseModel):
    results: list[DictionaryEntry]
    limit: int


def create_app(db_file: Path | None = None, *, resources: Path | None = None,
               frontend: Path | None = None) -> FastAPI:
    database = Path(db_file or os.environ.get("ZIDI_DB_PATH", BACKEND_ROOT / "dictionary.sqlite3"))
    resources = resources or BACKEND_ROOT / "resources"

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if not database.exists():
            logging.getLogger(__name__).warning("Building dictionary database on first startup; please wait.")
            database.parent.mkdir(parents=True, exist_ok=True)
            # Publish only a complete database, so an interrupted first startup
            # won't leave a partial database that subsequent launches reuse.
            with tempfile.TemporaryDirectory(dir=database.parent) as temporary:
                pending = Path(temporary) / "dictionary.sqlite3"
                DictionaryBuilder(
                    pending,
                    resources / "dictionary_char_2025-12-27.jsonl",
                    resources / "dictionary_word_2025-12-27.jsonl",
                ).create_database()
                pending.replace(database)
        ensure_usage_ranks(database, resources / "dictionary_char_2025-12-27.jsonl")
        yield

    app = FastAPI(title="Zidi dictionary", lifespan=lifespan)

    @app.get("/api/dictionary/search", response_model=SearchResponse)
    def search(q: str = Query(min_length=1, max_length=200),
               mode: SearchMode = "character",
               limit: int = Query(default=50, ge=1, le=100)):
        return {"results": search_dictionary(database, q.strip(), mode, limit), "limit": limit}

    frontend = frontend if frontend is not None else BACKEND_ROOT.parent / "dist"
    if frontend.is_dir():
        app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
    return app


app = create_app()
