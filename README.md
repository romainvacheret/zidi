# Zìdì (字缔)

Explore relations between Chinese words and their constituent characters.

## Development

Use Node.js 22.12+, 24, or 26+ (matching the supported ranges in `package.json`) and npm.

```sh
npm ci
npm run dev
```

Vite serves the app at the URL printed in the terminal. `npm start` is an alias for the same development server.

## Checks and production build

```sh
npm run check
```

This runs ESLint, TypeScript checking, the production build, and Vitest tests. Individual commands are `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test`. Use `npm run test:watch` during development.

The production build is written to `dist/`. Run `npm run preview` to inspect it locally.

## Project documentation

Planning and work tracking live under [docs/](docs/plans/revival.md). See the [work tracking conventions](docs/agents/issue-tracker.md) and [domain documentation conventions](docs/agents/domain.md).
