# Starling Driver Partners

A mobile-first webapp for Starling Driver Partners that allows delivery drivers to create secure accounts, manage their profiles, and complete the onboarding process.

## Overview

This application provides:
- **Secure Authentication**: Login with Google, GitHub, Apple, email via Replit Auth
- **Driver Profiles**: Personal info, address, e-transfer email, vehicle details
- **Onboarding Wizard**: Step-by-step guide for new drivers
- **Agreement Signing**: External Dropbox Sign integration for Driver Partner Agreement

## Key Requirements

- **Canadian Phone Numbers**: Validated format (e.g., 416-555-1234)
- **E-Transfer Auto-Deposit**: Drivers must confirm auto-deposit is enabled
- **Google Places API**: Address autocomplete with Canadian addresses only
- **Vehicle Photos**: Required photos of vehicle and license plate (base64 stored)
- **Dropbox Sign**: Agreement must be signed at https://app.hellosign.com/s/EzWAyRrV
- **Onfleet Integration**: Sync drivers to Onfleet when onboarding completes

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **Routing**: wouter
- **State Management**: TanStack Query

## Project Structure

```
client/
  src/
    pages/
      landing.tsx      - Landing page for logged-out users
      dashboard.tsx    - Main dashboard for logged-in drivers
      onboarding.tsx   - 4-step onboarding wizard
      profile.tsx      - Edit personal info and address
      vehicle.tsx      - Edit vehicle information
      agreement.tsx    - View/sign partner agreement
    hooks/
      use-auth.ts      - Authentication hook
    lib/
      queryClient.ts   - TanStack Query configuration
      auth-utils.ts    - Auth utility functions

server/
  routes.ts            - API endpoints
  storage.ts           - Database operations
  db.ts                - Database connection
  onfleet.ts           - Onfleet API integration
  replit_integrations/
    auth/              - Replit Auth integration

shared/
  schema.ts            - Drizzle schemas & types
  models/
    auth.ts            - User & session models
```

## Key Features

### Onboarding Flow (4 Steps)
1. **Personal Info**: Name, email, phone, e-transfer email
2. **Address**: Street address, city, province, postal code
3. **Vehicle**: Make, model, year, color, license plate
4. **Agreement**: Review and sign the Driver Partner Agreement

### Availability Calendar
- Drivers can proactively mark dates as available/unavailable
- Calendar view with month navigation
- Can specify packaging equipment (thermal blanket, thermal bag, other)
- Add notes for specific dates
- Data shared with admin app via external API

### Availability Response Links
- Drivers receive SMS links for specific dates (from admin app)
- Links route to `/respond/:token` for quick responses
- Drivers can mark available/unavailable with packaging info
- Responses stored locally and synced to admin app

### Database Schema

**driver_profiles**
- Personal information (name, email, phone)
- Address details
- E-transfer email for payments
- Vehicle information
- Onboarding progress tracking
- Agreement signing status
- Onfleet integration (onfleetId, onfleetSyncedAt)

**driver_availability**
- Date-based availability records
- Status: available, unavailable, pending
- Packaging equipment flags
- Optional notes
- Response timestamps

### Onfleet Integration

When onboarding completes, the system syncs the driver to Onfleet:
1. **Check if worker exists** - Looks up by phone number using `GET /workers?phones=`
2. **If exists** - Stores the Onfleet worker ID (existing drivers migrate seamlessly)
3. **If not exists** - Creates a new worker with name, phone, vehicle details

**Configuration:**
- API Key: `STARLING_STAGING_API_KEY` (stored as secret)
- Default Team: CookUnity Staging (`BPFsaTGXIHgF90hxup3XikF2`)

## API Endpoints

### Driver Endpoints (Authenticated)
- `GET /api/profile` - Get current driver's profile
- `POST /api/profile` - Create new driver profile
- `PATCH /api/profile` - Update driver profile (triggers Onfleet sync)
- `GET /api/availability` - Get driver's availability calendar
- `POST /api/availability` - Set availability for a date
- `GET /api/auth/user` - Get authenticated user
- `GET /api/login` - Initiate login flow
- `GET /api/logout` - Logout and end session

### Admin Endpoints
- `GET /api/admin/users` - Get all users with their profiles (admin view)

### External API (Requires X-API-Key header)
- `GET /api/external/availability/:onfleetId` - Get driver availability by Onfleet ID
- `GET /api/external/availability-by-phone/:phone` - Get driver availability by phone

### Availability Response Proxy (Public)
- `GET /api/availability-response/:token` - Get availability request details
- `POST /api/availability-response/:token` - Submit availability response

## Admin Features

### Admin Dashboard (`/admin`)
- View all registered users and their information
- See last login times for each user
- Track onboarding completion status (Completed, Step X/4, No Profile)
- Monitor Onfleet sync status for each driver
- Summary cards showing total users, completed, in-progress, and no-profile counts

## Development

The application runs with `npm run dev` which starts both the Express backend and Vite frontend on port 5000.

## Design

- Mobile-first responsive design
- Blue primary color scheme (#3b82f6)
- Clean, professional appearance
- Card-based UI components
- Progress indicators for onboarding
