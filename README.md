# Zìdì (字缔)

Search the Chinese dictionary and explore relations between Chinese words and their constituent characters in two tabs.

## Development

Use Node.js 22.12+, 24, or 26+ (matching the supported ranges in `package.json`) and npm.

```sh
npm ci
npm run dev
```

Vite serves the app at the URL printed in the terminal. `npm start` is an alias for the same development server.

Start the Python backend in a second terminal (Python 3.10+):

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m uvicorn cidian.api:app --reload --host 127.0.0.1 --port 8000
```

On Windows, use `.venv\Scripts\python` instead of `.venv/bin/python`.
The first backend startup builds `backend/dictionary.sqlite3` from the bundled JSONL resources; wait for startup to finish before searching. Later starts reuse it. Set `ZIDI_DB_PATH` to use another database location. Resource paths are resolved from the backend directory, independently of the working directory.

Vite proxies `/api` requests to FastAPI on port 8000. Open the Vite URL for development. The Dictionary tab searches both characters and complete words by simplified/traditional Chinese, pinyin, or English. Pinyin accepts spaces, tone numbers and tone marks: for example `照顾`, `zhaogu`, `zhao gu`, `zhao4gu`, or `zhào gu`. Numbered and marked searches preserve tone distinctions; tone-free searches match all tones.

Results include a word’s pinyin and definitions, alongside character matches where applicable. Translation searches include matching words and retain constituent-character matches. Usage ordering uses subtitle ranks, falling back to book ranks: `movieCharRank`/`bookCharRank` for characters and `movieWordRank`/`bookWordRank` for words. Unranked entries come last; ordering and deduplication happen before the 50-entry limit. Existing databases upgrade automatically on backend startup without rebuilding dictionary records.

## Checks and production build

```sh
npm run check
```

This runs ESLint, TypeScript checking, the production build, and Vitest tests. Individual commands are `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test`. Use `npm run test:watch` during development.

The production build is written to `dist/`. Run `npm run preview` to inspect it locally.

Run backend tests from `backend/` after installing `requirements-dev.txt`:

```sh
.venv/bin/python -m unittest discover -s tests -v
```

To run the complete built application from one local URL, run `npm run build`, then start FastAPI with the command above (or run `.venv/bin/python __main__.py` from `backend/`). Open <http://127.0.0.1:8000>. Restart FastAPI if the frontend build was created after backend startup. API documentation is available at <http://127.0.0.1:8000/docs>.

The HTTP API and dictionary operations are separate from the React interface. A future pywebview host can load this same local URL and manage server startup without coupling dictionary logic to a desktop framework. Pywebview packaging and lifecycle management are deferred; PySide is no longer required to run the app.

## Character details

Select a dictionary result to inspect its readings, definition, stroke count, HSK level, usage ranks, origin notes, components, and common words where available. Desktop uses a side panel so search results stay accessible; smaller screens use a full-screen dialog. Close it with the close button or Escape; keyboard focus returns to the selected result.

Choose **Open full details** for a dedicated entry with the complete common-word list, variants, and dictionary sources. Entry URLs such as `/#/dictionary/%E4%B8%96` can be bookmarked or opened directly. Browser Back and **Back to results** preserve the current search during the session. On first startup after this update, existing databases are upgraded from the bundled source records automatically; future startups reuse them.

Full character entries also show **Stroke order** and **Component decomposition** using bundled vector data. Play/pause or change animation speed, step with the arrows, reset, or scrub the stroke slider. Select a component in the legend to highlight its matching colored strokes; **Explore** opens that component’s entry. Unmapped strokes remain gray, and missing graphics are identified explicitly. The diagrams work offline, support reduced-motion preferences with manual stepping, and credit Dong Chinese and Make Me a Hanzi beneath the illustrations.

## Graph exploration

Use **Search graph** above the sidebar list to narrow its entries by Chinese text, dictionary pinyin, or English meaning. Pinyin filtering ignores tones and accepts spaces, tone numbers, and `ü`/`v`. The matching count updates as you type; clear the field to restore every entry. Filtering affects only the list, preserving the graph layout and selection.

Click a graph node or select it in the sidebar to see a small, clickable preview with pinyin and a short English meaning. It follows the node while panning and zooming. Click the preview to open the entry; close it with ×, Escape, or a canvas-background click. Selecting the node again reopens the preview and recenters it.

**View in graph** on an entry opens the Graph tab centered on that character or word. Graph targets use bookmarkable URLs such as `/#/graph/%E4%B8%96`. Opening **View in graph** replaces the graph with a focused neighborhood around that entry, across all dictionary levels.

Word entries use the full dictionary, including traditional forms, definitions, usage ranks and constituent-character links. Readings and meanings fetched for the current graph remain available as a session fallback. Nodes without HSK metadata load their previews from the dictionary API. Focused words link to their constituent characters and nearby words sharing those characters.

## Project documentation

Planning and work tracking live under [docs/](docs/plans/revival.md). See the [work tracking conventions](docs/agents/issue-tracker.md) and [domain documentation conventions](docs/agents/domain.md).

The [graph architecture guide](docs/architecture/graph.md) explains vocabulary relationships, simulation state, selection, resizing, and validation.

### Bounded dictionary graph

The graph uses the backend dictionary JSONL resources through `GET /api/graph/vocabulary`; the legacy frontend HSK lists have been removed. It starts with up to 200 vocabulary entries at internal dictionary HSK level 1, ordered by subtitle usage rank with book rank as fallback. Check one or more HSK levels (1–6 or the combined 7–9 tag) and a word limit (50, 100, 200, or 300) in the sidebar. These are the dictionary's existing internal classifications, not validated official HSK membership. Level selection matches the checked levels exactly for words and character nodes. Unchecked characters and their incident links are hidden; no checked levels produces an empty graph.

Each vocabulary entry links to its constituent Han characters. The graph stops at 500 total nodes, including those characters and dictionary selections. Select a character and choose **Expand** to add up to 20 more related vocabulary entries from the checked levels. Expansion retains existing nodes and excludes loaded expressions; changing level or word limit starts a fresh subset. Opening the Graph tab restores the default level 1 view with a 200-word limit. Loading failures offer a retry. The backend is required to load graph vocabulary.

**Focused neighborhoods:** **View in graph** from a detail page, a bookmarked `/#/graph/<entry>` URL, or **Focus on…** for a selected graph node replaces the graph with that entry and its character relations. A character includes incident words; a word includes its constituent characters and words sharing them, restricted to the checked internal HSK levels. These related words are at most two word–character links from the focus; constituent characters appear only when their own internal level is checked. If the focused entry falls outside the checked levels, it is hidden and the view explains why. More shared characters take priority, followed by usage frequency. The default is 50 related words, adjustable up to 300, within the same 500-node ceiling. **Back to HSK 1** or the **Graph** tab restores the default vocabulary view.

HSK checkboxes remain available in both the default graph and focused neighborhoods. Filtering rebuilds the actual canvas nodes and links, rather than only narrowing the sidebar. Filters persist when focusing another entry; opening the Graph tab resets to HSK 1 only.
