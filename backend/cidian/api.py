"""HTTP adapter for the dictionary; also serves the built React application."""

from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path
import tempfile
from typing import Literal

from fastapi import FastAPI, HTTPException, Path as PathParameter, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .db import DictionaryBuilder
from .db.dictionary_database import ensure_character_details, ensure_usage_ranks, ensure_word_search
from .dictionary import SearchMode, character_details, search_dictionary, word_details

BACKEND_ROOT = Path(__file__).resolve().parents[1]


class DictionaryEntry(BaseModel):
    character: str
    pinyin: str
    gloss: str | None
    codepoint: str | None
    kind: Literal["character", "word"] = "character"


class SearchResponse(BaseModel):
    results: list[DictionaryEntry]
    limit: int


class CharacterComponent(BaseModel):
    character: str
    roles: list[str]
    hint: str | None


class CharacterWord(BaseModel):
    word: str
    traditional: str | None
    gloss: str | None


class CharacterStrokeData(BaseModel):
    strokes: list[str]
    medians: list[list[tuple[float, float]]]
    component_indices: list[int | None]
    source: str


class CharacterDetails(DictionaryEntry):
    stroke_data: CharacterStrokeData | None = None
    stroke_count: int | None
    original_meaning: str | None
    hint: str | None
    hsk_level: int | None
    movie_rank: int | None
    book_rank: int | None
    readings: list[str]
    components: list[CharacterComponent]
    words: list[CharacterWord]
    variants: list[str]
    sources: list[str]


class WordDetails(DictionaryEntry):
    kind: Literal["character", "word"] = "word"
    traditional: str | None
    readings: list[str]
    definitions: list[str]
    hsk_level: int | None
    movie_rank: int | None
    book_rank: int | None
    characters: list[str]
    sources: list[str]


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
        ensure_character_details(database, resources / "dictionary_char_2025-12-27.jsonl")
        ensure_word_search(database, resources / "dictionary_word_2025-12-27.jsonl")
        yield

    app = FastAPI(title="Zidi dictionary", lifespan=lifespan)

    @app.get("/api/dictionary/search", response_model=SearchResponse)
    def search(q: str = Query(min_length=1, max_length=200),
               mode: SearchMode = "character",
               limit: int = Query(default=50, ge=1, le=100)):
        return {"results": search_dictionary(database, q.strip(), mode, limit), "limit": limit}

    @app.get("/api/dictionary/characters/{character}", response_model=CharacterDetails)
    def details(character: str = PathParameter(min_length=1, max_length=1)):
        result = character_details(database, character)
        if result is None:
            raise HTTPException(status_code=404, detail="Character not found")
        return result

    @app.get("/api/dictionary/words/{word}", response_model=WordDetails)
    def word_entry(word: str = PathParameter(min_length=2, max_length=200)):
        result = word_details(database, word)
        if result is None:
            raise HTTPException(status_code=404, detail="Word not found")
        return result

    frontend = frontend if frontend is not None else BACKEND_ROOT.parent / "dist"
    if frontend.is_dir():
        app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
    return app


app = create_app()
