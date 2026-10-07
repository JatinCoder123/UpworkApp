# UpWorkApp frontend

## Microsoft authentication

Authentication is handled by the separate Express backend. In production the frontend uses
`https://upworkapp.backend.outrightcrm.in`. Set `VITE_AUTH_BASE_URL` to override that origin.

For local development, copy `.env.example` to `.env.local` and ensure the backend permits the
frontend origin through its `APP_URL` configuration. The browser must be able to send credentialed
CORS requests to the authentication backend.

The backend must set `LOGIN_SUCCESS_PATH=/jobs` so a successful Microsoft callback returns users
to the application.

## Development

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
