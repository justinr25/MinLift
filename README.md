# MinLift

A high-contrast minimalist, offline-capable universal (iOS, Android, Web) workout and weightlifting logging application designed for rapid, zero-friction in-gym tracking.

---

## Tech Stack

- **Frontend Framework:** Expo (SDK 57) + Expo Router (Universal React Native & Web)
- **Language:** TypeScript (Strict Mode)
- **Styling & Design System:** NativeWind v4 (Tailwind CSS) + Apple Human Interface Guidelines (HIG)
- **Backend & Database:** Supabase (PostgreSQL 15, Row Level Security, Supabase Auth)
- **State Management:** Zustand with local storage persistence
- **Local Development:** Supabase CLI + Docker + Apple Xcode iOS Simulator

---

## Prerequisites

1. Node.js (`v20+` or `v22+`) and npm
2. Docker Desktop (running in the background for local Supabase)
3. Xcode and iOS Simulator (for running the simulated iPhone on macOS)

---

## Development Workflow

### Step 1: Start Local Supabase (Backend)

Ensure Docker Desktop is running, then execute in the project root:

```bash
npx supabase start
```

Starts local PostgreSQL, Supabase Auth, and the local web dashboard.

- **Supabase Studio (Web UI):** Open `http://localhost:54323` in a browser to view database tables, execute SQL queries, and inspect authentication users.

---

### Step 2: Start Expo (Frontend) and Open iOS Simulator

In the project root, execute:

```bash
npx expo start
```

When the interactive Expo terminal menu appears, press `i` on the keyboard:

- Expo will launch the iOS Simulator on macOS.
- The development client installs and loads code with instant fast refresh.

Alternatively, execute `npx expo start --ios` to launch the simulator directly.

---

## Expo Terminal Keyboard Shortcuts

While `npx expo start` is running in the terminal:

| Key | Action              | Description                                               |
| :-: | :------------------ | :-------------------------------------------------------- |
| `i` | Open iOS Simulator  | Launches virtual iPhone running live application on macOS |
| `w` | Open in Web Browser | Opens React Native Web build in browser                   |
| `r` | Reload Application  | Triggers an immediate bundle reload                       |
| `j` | Open Debugger       | Opens Chrome DevTools debugger                            |
| `c` | Clear Console       | Clears terminal log output                                |

---

## Supabase CLI Reference

| Task            | Command                       | Description                                                        |
| :-------------- | :---------------------------- | :----------------------------------------------------------------- |
| Start Database  | `npx supabase start`          | Initializes local database and authentication containers in Docker |
| Stop Database   | `npx supabase stop`           | Pauses containers when development session ends                    |
| Reset and Seed  | `npx supabase db reset`       | Re-executes all migrations and seeds default data                  |
| Status and Keys | `npx supabase status`         | Displays local API URL (`http://localhost:54321`) and anon key     |
| Web Dashboard   | Open `http://localhost:54323` | Visual table editor, SQL editor, and user inspector                |

---

## Automated Testing Suite

MinLift includes end-to-end integration test runners that execute directly against local Supabase PostgreSQL:

```bash
# Run specific phase test suite
npm run test:phase3   # Core in-gym active workout logging (29 assertions)
npm run test:phase4   # History feed & interactive detail editing (37 assertions)
npm run test:phase5   # Exercises catalog, notes & template linking (43 assertions)
npm run test:phase6   # Profile tab, volume stats & offline mutation queue (45 assertions)

# Run full project type check
npm run check         # npx tsc --noEmit (strict typecheck)
```

---

## Project Structure

```
MinLift/
├── app/                        # Expo Router file-based routes
│   ├── (auth)/                 # Authentication screens (Sign In, Sign Up)
│   ├── (tabs)/                 # Universal 5-Tab Navigation (Permanently Pinned Tab Bar)
│   │   ├── _layout.tsx         # Bottom tab bar with active indicator dot
│   │   ├── index.tsx           # Home Dashboard (Wireframe 3)
│   │   ├── workout/            # Nested workout stack (Idle, select location/type, live logger)
│   │   ├── history/            # Nested history stack (History feed index, interactive detail editor)
│   │   ├── exercises/          # Nested exercise catalog stack (Catalog index, exercise detail)
│   │   └── profile.tsx         # Profile & Settings (Wireframe 11: 5-bar volume, unit toggle, sync)
│   └── _layout.tsx             # Root layout with SafeAreaProvider, auth listener, and global CSS
├── src/
│   ├── components/
│   │   ├── ui/                 # Atomic UI primitives (PrimaryButton, HeroStartButton, SetRow, etc.)
│   │   └── workout/            # Domain components (ExerciseLoggerCard, AddExerciseSheet, Timer)
│   ├── hooks/                  # Custom hooks (useWorkoutTimer, useOfflineSync)
│   ├── lib/                    # Supabase client and offline mutation queue (offline-queue.ts)
│   ├── stores/                 # Zustand stores (auth, active-workout, workout, exercise, sync)
│   └── types/                  # TypeScript database definitions (database.ts)
├── scripts/                    # Headless integration test suites (test-phase3, 4, 5, 6)
├── supabase/
│   ├── migrations/             # SQL schema migrations (profiles, workouts, sets, exercises, etc.)
│   └── seed.sql                # Default seed data (Push, Pull, Legs)
├── tailwind.config.ts          # NativeWind monochrome design tokens
└── tsconfig.json               # TypeScript strict mode configuration
```
