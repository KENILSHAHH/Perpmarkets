This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) and integrated with [Privy](https://privy.io) for wallet connectivity.

## Getting Started

### Prerequisites

1. Get your Privy App ID from [Privy Dashboard](https://dashboard.privy.io/)
2. Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

3. Add your Privy App ID and Polymarket API keys to `.env.local`:

```
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here

# Polymarket API Keys (optional, for authenticated endpoints)
PM_API_KEY=your_polymarket_api_key
PM_API_SECRET=your_polymarket_api_secret
PM_API_PASSPHRASE=your_polymarket_api_passphrase
```

**Note:** The Polymarket API keys are optional. The market WebSocket channel works without authentication. API keys are only needed if you plan to use authenticated endpoints or the user WebSocket channel.

### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Privy Integration

This project uses [Privy](https://privy.io) for wallet connectivity. The wallet connection component is located at `src/components/WalletButton.tsx`.

### Features

- Multiple login methods: Email, Wallet, SMS, Social logins (Google, Apple, Twitter, Discord, GitHub, TikTok, LinkedIn, Farcaster)
- Embedded wallet support
- Wallet connection and disconnection
- Display connected wallet information

### Configuration

Privy is configured in `src/app/layout.tsx`. You can customize:
- Login methods
- Appearance theme
- Embedded wallet settings

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
