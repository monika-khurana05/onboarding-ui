# How to Run This Project

This is a React + TypeScript + Vite project for the Country Onboarding UI application.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or later recommended)
- **npm** or **yarn** package manager

To check your versions:
```bash
node --version
npm --version
```

## Installation

1. **Clone/Navigate to the project directory:**
   ```bash
   cd onboarding-ui
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   Or if using yarn:
   ```bash
   yarn install
   ```

## Development

### Start the Development Server

```bash
npm run dev
```

This will start the Vite development server, typically at `http://localhost:5173`. The app will automatically reload when you make changes to the code.

### Run TypeScript Type Check

```bash
npm run typecheck
```

Verifies that all TypeScript types are correct without building.

## Building

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

Serves the production build locally for testing.

## Code Quality

### Linting

Check for code style issues:
```bash
npm run lint
```

Fix issues automatically:
```bash
npm run lint:fix
```

### Code Formatting

Check formatting with Prettier:
```bash
npm run format
```

Auto-format all files:
```bash
npm run format:fix
```

## Testing

### Unit Tests

Run all tests once:
```bash
npm run test
```

Run tests in watch mode (re-runs on file changes):
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory.

### End-to-End Tests

Run Playwright e2e tests:
```bash
npm run e2e
```

## Project Structure

```
src/
|-- api/              # API client and types
|-- app/              # Root app components and context
|-- components/       # Reusable UI components
|-- features/         # Feature-specific modules
|   |-- countries/    # Country management
|   `-- onboarding/   # Onboarding flow
|-- lib/              # Utility functions and clients
|-- mocks/            # MSW mock handlers
|-- models/           # Data models
|-- pages/            # Page components
`-- theme/            # Theme configuration
```

## Key Routes

- `/` - Dashboard
- `/snapshots/new` - Create Snapshot Wizard
- `/snapshots/:snapshotId` - Snapshot Details
- `/generate/preview` - Preview Generation
- `/jobs` - Jobs Placeholder
- `/settings` - Settings/About

## Tech Stack

- **React** 18 - UI Framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching
- **MUI** - Component library
- **React Hook Form** - Form state management
- **Zod** - Schema validation
- **Vitest** - Unit testing
- **Playwright** - E2E testing
- **Monaco Editor** - Code editor component

## Environment Configuration

The application derives the environment (DEV/UAT/PROD) from the API URL. Configuration can be found in:
- `src/lib/env.ts` - Environment variables
- `src/lib/environment.ts` - Environment setup
- `src/theme/theme.ts` - Theme and styling

## Troubleshooting

### Port Already in Use

If port 5173 is already in use, Vite will automatically try the next available port.

### Dependencies Installation Issues

Clear npm cache and reinstall:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Build Fails with TypeScript Errors

Run type check and fix issues:
```bash
npm run typecheck
```

### Tests Fail

Ensure all dependencies are installed and try:
```bash
npm run test:watch
```

This will show detailed error messages.

## Development Workflow

1. Start development server: `npm run dev`
2. Make code changes
3. Run tests: `npm run test:watch`
4. Check linting: `npm run lint:fix`
5. Format code: `npm run format:fix`
6. Type check: `npm run typecheck`
7. Build for production: `npm run build`

## Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [MUI Documentation](https://mui.com/)
- [React Router Documentation](https://reactrouter.com/)
- [React Query Documentation](https://tanstack.com/query/latest/)

