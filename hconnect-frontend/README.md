# HCONNECT Frontend

HCONNECT frontend is a React + Vite single page application for doctor and patient workflows.

## Tech stack

- React 19
- React Router 6
- Auth0 React SDK
- Tailwind CSS
- Vite

## Local development

Prerequisites:

- Node.js 18+ (20+ recommended)
- npm
- Backend API running locally (default: http://localhost:3000)

Install and run:

1. Install dependencies

	npm install

2. Create env file

	copy .env.example .env

3. Start dev server

	npm run dev

App default URL: http://localhost:5173

## Environment variables

The frontend currently requires:

- VITE_API_BASE_URL

Recommended values:

- Local development: http://localhost:3000
- Same-domain reverse proxy: /

## Scripts

- npm run dev: start development server
- npm run build: create production build
- npm run preview: preview production build locally
- npm run lint: run ESLint

## Main user flows

- Role selection at /
- Patient entry at /patient/entry
- Patient registration at /patient/register
- Doctor dashboard at /dashboard
- Patient dashboard at /patient/dashboard

## Related docs

- Root project guide: ../README.md
- Backend API and env setup: ../hconnect-backend/.env.example

## Troubleshooting

If API requests fail in development:

1. Confirm backend is running on the same origin set by VITE_API_BASE_URL.
2. Confirm Auth0 settings allow localhost callbacks/origins.
3. Check browser console network errors and backend logs.
