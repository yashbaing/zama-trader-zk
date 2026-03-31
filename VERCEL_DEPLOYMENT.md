# Vercel Deployment Guide for ZKTrader

## Overview

ZKTrader is deployed on Vercel as a Next.js frontend within a monorepo architecture. This guide explains the setup and how to deploy successfully.

## Project Structure

```
zktrader/
├── frontend/          # Next.js app (deployed to Vercel)
├── backend/          # Express API (deploy separately or use external service)
├── contracts/        # Smart contracts (Solidity)
├── vercel.json       # Vercel deployment config
├── package.json      # Root workspace config
└── .vercelignore     # Files to ignore during deployment
```

## Deployment Configuration

### vercel.json

The root `vercel.json` file configures Vercel to:
- Build the frontend from the monorepo structure
- Install dependencies with pnpm (workspace aware)
- Output the built Next.js app from `frontend/.next`
- Set environment variables for the frontend

### .vercelignore

Ignores non-essential directories during deployment:
- `backend/` — API server (not needed for frontend deployment)
- `contracts/` — Smart contracts (not needed for frontend)
- `docs/` — Documentation
- `node_modules/` — Regenerated during build
- `.git/` — Version control

## Environment Variables

Configure these in Vercel dashboard (Settings → Environment Variables):

```
NEXT_PUBLIC_API_URL=https://your-backend-api.com/api
NEXT_PUBLIC_CHAIN_ID=8009
NEXT_PUBLIC_RPC_URL=https://devnet.zama.ai
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_ORDER_BOOK_ADDRESS=0x...
NEXT_PUBLIC_TRADING_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_AUTO_INVEST_VAULT_ADDRESS=0x...
NEXT_PUBLIC_WBTC_ADDRESS=0x...
NEXT_PUBLIC_WETH_ADDRESS=0x...
NEXT_PUBLIC_WSOL_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
```

**Note:** Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Backend API credentials should NOT be exposed.

## Deploying to Vercel

### Option 1: Connect GitHub Repository (Recommended)

1. Go to https://vercel.com/new
2. Select "Import Git Repository"
3. Connect your GitHub account and select `yashbaing/zktrader`
4. Vercel automatically detects Next.js
5. Set environment variables in the "Environment Variables" section
6. Click "Deploy"

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
vercel --prod

# Follow the prompts to connect to your Vercel project
```

## Frontend Build Output

After successful build, Vercel deploys:
- Static HTML pages (all app routes)
- JavaScript bundles (chunks for each page)
- CSS and assets

Current routes deployed:
- `/` — Home page (redirects to /dashboard)
- `/dashboard` — Main trading dashboard
- `/trade` — Trading interface
- `/vault` — Vault management
- `/copy-trading` — Copy trading feature
- `/history` — Transaction history

## Backend Integration

The frontend connects to the backend API at the URL specified in `NEXT_PUBLIC_API_URL`.

### Local Development

```bash
cd frontend
pnpm dev
# Frontend at http://localhost:3000
# API calls to http://localhost:3001/api (as configured in .env.local)
```

### Production (Vercel)

Update `NEXT_PUBLIC_API_URL` to point to your deployed backend API:

```
NEXT_PUBLIC_API_URL=https://zktrader-api.your-domain.com/api
```

## Troubleshooting

### Build Fails: "Module not found: Can't resolve 'tfhe_bg.wasm'"

**Solution:** The `frontend/next.config.js` already handles WASM resolution. If the error persists:
1. Ensure `frontend/src/lib/fhevm-shim.ts` exists (fallback for missing wasm)
2. Update `next.config.js` to include wasm handling rules
3. Clear Vercel cache: Settings → Deployments → "Clear cache" → Redeploy

### 404 Error After Deployment

**Causes:**
1. Environment variables not set → Set them in Vercel dashboard
2. Backend API unreachable → Verify `NEXT_PUBLIC_API_URL` is correct
3. Build output directory wrong → Should be `frontend/.next`

**Solution:**
1. Check Vercel deployment logs (Deployments → View Logs)
2. Verify environment variables are set
3. Test API connectivity: `curl $NEXT_PUBLIC_API_URL/health`

### Build Too Slow or Times Out

**Solution:**
- Ensure `.vercelignore` excludes unnecessary directories
- Remove large files (videos, PDFs) from repo
- Use `.gitignore` to prevent tracking node_modules

## Continuous Deployment

When you push to `main` branch on GitHub:
1. Vercel automatically detects the push
2. Builds the frontend
3. Runs tests (if configured)
4. Deploys to production

To disable auto-deploy:
- Vercel dashboard → Project Settings → Git → Uncheck "Deploy on push"

## Monitoring & Logs

View deployment logs:
1. Vercel dashboard → Select project → Deployments tab
2. Click on a deployment → View Logs
3. Check build logs and runtime errors

## Domain & Custom URL

1. Add custom domain: Project Settings → Domains → Add
2. Follow DNS configuration instructions from your domain provider
3. Once verified, Vercel auto-renews SSL certificate

## Security Best Practices

1. **Never commit .env files** — Use `.env.example` and Vercel dashboard for secrets
2. **Use environment variables for sensitive data** — API keys, private keys, etc.
3. **Enable Vercel Analytics** — Settings → Analytics
4. **Set up access controls** — Collaborators → Invite team members
5. **Monitor deployment logs** — Watch for errors and vulnerabilities

## Performance Optimization

ZKTrader frontend is already optimized with:
- Next.js static generation (ISR)
- Image optimization
- Code splitting per page
- Tree-shaking via webpack
- Tailwind CSS purging

Further optimizations:
1. Enable Edge Cache: Settings → Performance
2. Use Vercel Analytics to identify slow pages
3. Optimize images: Use `next/image` component

## References

- [Vercel Next.js Documentation](https://vercel.com/docs/frameworks/nextjs)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [ZKTrader GitHub Repository](https://github.com/yashbaing/zktrader)
