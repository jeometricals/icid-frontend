# Quick Start Guide

Get ICID Co. running locally in 5 minutes!

## Fast Setup (Demo Mode - No Backend Required)

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Open http://localhost:3000
# Click "Trial Mode" to use the app immediately!
```

That's it! The app works in demo mode without any additional configuration.

## What You Get

- ✅ Full UI and all features
- ✅ Login page with demo mode
- ✅ Project selection
- ✅ Three inspection form types:
  - General Inspector's Report
  - Daily Site Patrol
  - Curb/Sidewalk/Concrete Base Report
- ✅ Responsive design for mobile/tablet
- ✅ Professional construction-themed UI

## Project Structure Quick Reference

```
src/
├── pages/
│   ├── LoginPage.jsx           # Login with demo mode
│   ├── ProjectSelectionPage.jsx # Choose a project
│   ├── ProjectDashboard.jsx     # Report type selection
│   └── reports/
│       ├── GeneralReportPage.jsx
│       ├── DailySitePatrolPage.jsx
│       └── CurbSidewalkPage.jsx
├── contexts/
│   └── AuthContext.jsx          # Authentication state
├── lib/
│   └── supabase.js             # Supabase client (optional)
└── App.jsx                      # Main app with routing
```

## Adding Supabase (Optional)

Want to save data? Set up Supabase:

1. **Create `.env` file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your Supabase credentials** to `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Restart the dev server**:
   ```bash
   npm run dev
   ```

Now you can use real authentication and data persistence!

## Common Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Deploy to Vercel
vercel
```

## Making Changes

### Add a New Form Field

1. Open the relevant report page in `src/pages/reports/`
2. Add the field to the `formData` state
3. Add the input element to the JSX
4. Wire up the `onChange` handler

### Customize Colors

Edit `tailwind.config.js`:
```javascript
colors: {
  construction: {
    600: '#your-color',
    // ...
  }
}
```

### Add a New Report Type

1. Create new component in `src/pages/reports/YourReportPage.jsx`
2. Add route in `src/App.jsx`
3. Add button in `src/pages/ProjectDashboard.jsx`

## Testing the App

### Test Demo Mode
1. Go to `/login`
2. Click "Trial Mode"
3. Navigate through projects and forms

### Test with Real Data (if Supabase configured)
1. Enter credentials on login page
2. Data will save to Supabase

## Deployment

Deploy to Vercel in 2 minutes:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or use the Vercel dashboard - see [DEPLOYMENT.md](./DEPLOYMENT.md) for details.

## Troubleshooting

### Port 3000 already in use
```bash
# Kill the process
lsof -ti:3000 | xargs kill -9

# Or change the port in vite.config.js
```

### Dependencies not installing
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Supabase not connecting
- Verify your `.env` file has correct credentials
- Make sure variables start with `VITE_`
- Restart dev server after changing `.env`

### Build errors
```bash
# Check for syntax errors
npm run lint

# Ensure Node version is 18+
node --version
```

## Next Steps

1. ✅ App running locally
2. 📱 Test on mobile/tablet (use your local IP)
3. 🎨 Customize the theme
4. 🚀 Deploy to Vercel
5. 📊 Connect Supabase for data persistence
6. 🔧 Add more report types

## Resources

- [Full README](./README.md) - Complete documentation
- [Deployment Guide](./DEPLOYMENT.md) - How to deploy
- [Vite Docs](https://vitejs.dev/) - Build tool
- [React Router](https://reactrouter.com/) - Routing
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Supabase Docs](https://supabase.com/docs) - Backend

## Getting Help

- Check the console for errors
- Look at the browser Network tab
- Review the component code
- Test in demo mode first

---

**Happy coding! 🚧👷‍♂️**
