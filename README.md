# ICID Co. Frontend

Integrated Construction Information Database - A digital field inspection and reporting system for construction inspectors.

## Overview

ICID Co. is a web application designed to replace paper-based construction inspection forms used on public infrastructure projects. It enables inspectors to create legally compliant, auditable inspection reports while working in the field.

## Features

- **User Authentication**: Supabase authentication with demo/trial mode
- **Project Management**: Select and manage multiple construction projects
- **Inspection Forms**:
  - General Inspector's Daily Report
  - Daily Site Patrol Checklist
  - Curb, Sidewalk, Concrete Base & Pedestrian Ramp Report
- **Weather Integration**: Automatic weather data for inspection dates
- **Responsive Design**: Optimized for tablets and mobile devices
- **Draft & Submit**: Save drafts and submit final reports

## Tech Stack

- **Frontend Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Authentication, Database, Storage)
- **Deployment**: Vercel
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Prerequisites

- Node.js 18+ and npm
- Supabase account (optional - demo mode available)
- Vercel account (for deployment)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd icid-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_WEATHER_API_KEY=your_weather_api_key
   ```

   **Note**: The app works in demo mode without Supabase configuration.

4. **Run development server**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

## Project Structure

```
icid-frontend/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable React components
│   ├── contexts/        # React contexts (Auth, etc.)
│   ├── lib/            # Utility functions and configurations
│   ├── pages/          # Page components
│   │   ├── reports/    # Report form pages
│   │   ├── LoginPage.jsx
│   │   ├── ProjectSelectionPage.jsx
│   │   └── ProjectDashboard.jsx
│   ├── App.jsx         # Main app component with routing
│   ├── main.jsx        # Application entry point
│   └── index.css       # Global styles
├── .env.example        # Environment variables template
├── index.html          # HTML entry point
├── package.json        # Dependencies and scripts
├── tailwind.config.js  # Tailwind configuration
├── vite.config.js      # Vite configuration
└── README.md          # This file
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Usage

### Demo Mode

1. Navigate to the login page
2. Click "Trial Mode" button
3. Access all features with demo data

### With Supabase

1. Configure Supabase credentials in `.env`
2. Sign in with your Supabase user credentials
3. Data will be persisted to your Supabase database

### Creating an Inspection Report

1. Select a project from the project list
2. Choose a report type from the dashboard
3. Fill in the required fields
4. Save as draft or submit the report
5. Attach photos and documents as needed

## Deployment to Vercel

### Option 1: Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Follow the prompts to link your project

### Option 2: Vercel Dashboard

1. Push your code to GitHub
2. Import the project in Vercel dashboard
3. Configure environment variables
4. Deploy

### Environment Variables on Vercel

Add these environment variables in your Vercel project settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_WEATHER_API_KEY`

## Supabase Setup (Optional)

If you want to use Supabase instead of demo mode:

1. Create a Supabase project at https://supabase.com
2. Set up the following tables:
   - `projects` - Project information
   - `reports` - Inspection reports
   - `users` - User profiles
3. Enable authentication providers
4. Configure row-level security policies
5. Add your Supabase credentials to `.env`

## Browser Support

- Chrome/Edge (recommended for field use)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

Copyright © 2024 ICID Co. All rights reserved.

## Support

For issues and questions, please contact the development team.

## Roadmap

- [ ] Additional report types (Sewer, Water Main, Utilities)
- [ ] PDF generation and export
- [ ] Offline mode with sync
- [ ] Photo annotation tools
- [ ] OCR for violation notices
- [ ] Supervisor review workflows
- [ ] Mobile app (iOS/Android)
