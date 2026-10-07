# Student Management System

An offline-first React and Vite school administration portal. Student, attendance, and school settings are stored in this browser's IndexedDB database; no backend or internet service is used by the application.

## Requirements

- Node.js 18 or newer and npm, for installing dependencies and running the local development server.
- A modern browser with IndexedDB and Web Crypto support.

## Run locally

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite. The portal itself has no remote runtime dependencies. After installation, it can be used offline while the local server is running.

## Admin access

- Username: `jawad`
- Password: `jawad123`

The login is client-side access control for this local application, not server-enforced security. The password is checked against a SHA-256 verifier in the app bundle and is not saved as plaintext. The temporary login session is held in `sessionStorage`, expires after eight hours, and is cleared by Log out. A person with access to the app files or browser developer tools can bypass client-side checks.

## Production build

```bash
npm run build
npm run preview
```

Vite writes the production assets to `dist/`. The preview command serves the build locally; deployment on a local static server also works without any application backend.

## Publish on GitHub Pages

The repository includes a GitHub Actions workflow that builds and publishes the site whenever changes are pushed to `main`. In the repository settings, open **Pages** and set the build/deployment source to **GitHub Actions**. After the workflow completes, the project site will be available at:

`https://jawadakbar65.github.io/Student_Portal/`

The Pages base path is configured for this repository name. If the repository is renamed, update `base` in `vite.config.js` to match the new project path.

## Local records and backups

Student records, attendance entries, and school settings persist in IndexedDB across refreshes and browser restarts. Use **Backup & Restore** to download a JSON backup regularly. Restoring a backup replaces the records currently in this browser. Browser data can still be lost if site storage is manually cleared or the browser profile is deleted; keep exported backups outside the browser profile.

Student photographs and the school logo are stored locally in the database/settings. Individual student profiles and ID cards can be printed or downloaded as PDFs; the student register can be exported as a PDF.