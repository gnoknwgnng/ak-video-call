# Deployment to Vercel - Updated Guide

This guide will help you deploy your Omegle-like video chat application to Vercel with proper WebSocket support.

## Prerequisites

1. A Vercel account (free at [vercel.com](https://vercel.com))
2. Your project code pushed to a GitHub/GitLab/Bitbucket repository
3. Supabase account with the tables created as per `SUPABASE_SETUP.md`

## Deployment Steps

### 1. Prepare Your Repository

Make sure your repository has the following structure:
```
your-project/
├── api/
│   ├── index.js
│   └── socket.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── vercel.json
├── package.json
└── README.md
```

### 2. Set Environment Variables in Vercel

After importing your project to Vercel, go to your project settings and add these environment variables:

1. `SUPABASE_URL` - Your Supabase project URL
2. `SUPABASE_ANON_KEY` - Your Supabase anon key

### 3. Update Your Code to Use Environment Variables

In your `api/socket.js` file, replace the hardcoded Supabase credentials with environment variables:

```javascript
// Replace the hardcoded values with:
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
```

### 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your Git repository
4. Vercel will automatically detect the framework
5. Click "Deploy"

### 5. Configure WebSocket Support

After deployment, make sure to check the Vercel logs for any errors. The WebSocket connections should work with the updated configuration.

## Troubleshooting

### FUNCTION_INVOCATION_FAILED Error

If you encounter this error:

1. Check the Vercel logs for specific error messages
2. Ensure all dependencies are properly listed in package.json
3. Verify that your serverless functions don't have infinite loops
4. Make sure environment variables are correctly set

### Connection Issues

If users can't connect with each other:

1. Verify that the Supabase tables are created correctly
2. Check that environment variables are set in Vercel
3. Ensure the Supabase credentials are correct
4. Check the Vercel logs for any database connection errors

## Supabase Tables

Make sure you have created the required tables in Supabase by running the SQL commands in `SUPABASE_SETUP.md`:

1. `queues` table for user queuing
2. `users` table for user information and pairing

## Environment Variables

Set these environment variables in your Vercel project settings:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key

## Testing Locally

Before deploying, test your application locally:

```bash
npm install
npm start
```

Visit `http://localhost:3000` to test the application.

## Scaling Considerations

This application uses Supabase for shared state management, which allows it to scale across multiple serverless instances. Each user connection can be handled by a different instance, but they can still find each other through the shared database.