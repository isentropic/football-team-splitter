# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```


## Club Awards 2026

Voting: `/awards`. Admin results and participation: `/awards/admin` (existing admin login).

Production is `https://seoulnomads.pages.dev`, configured explicitly in `wrangler.production.toml`. Before deploying, apply the additive awards migration to production. Do not run `schema.sql`, which drops players.

```sh
CLOUDFLARE_ACCOUNT_ID=8802c988895378137ab2863a9ce8147a npx wrangler d1 execute DB --config wrangler.production.toml --remote --file migrations/v4.sql
bash scripts/deploy-production.sh
```

The deployment script builds the app and stages the production configuration as `wrangler.toml`, as required by Cloudflare Pages. It includes Functions and shared source imports, and does not copy local credentials or database files.

Regular local database migration:
```sh
node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --file migrations/v4.sql
```

Eligibility uses non-retired players appearing on a participating team in a recorded 2026 game, using Seoul calendar boundaries. Voting opens October 16 and closes October 24 at 00:00 KST. Ballots contain zero to three ranked choices per category and at least one nonempty category. First choice earns 3 points, second 2, and third 1, even when fewer than three choices are selected. A database primary key enforces one final ballot per player/year. Results use points, first-place votes, then second-place votes; remaining ties share a rank. Individual ballots are never returned by the results API. Selecting a name is trust-based identification. Private invitation links can be added later.
