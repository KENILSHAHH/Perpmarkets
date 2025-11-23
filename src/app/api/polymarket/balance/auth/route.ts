import { NextResponse } from 'next/server'

// Get API keys from environment variables
const getApiKeys = () => {
  return {
    apiKey: process.env.PM_API_KEY,
    apiSecret: process.env.PM_API_SECRET,
    apiPassphrase: process.env.PM_API_PASSPHRASE,
  }
}

// Similar to nitrolite: provide auth for WebSocket connection
export async function GET() {
  const apiKeys = getApiKeys()
  
  if (!apiKeys.apiKey || !apiKeys.apiSecret || !apiKeys.apiPassphrase) {
    return NextResponse.json(
      { error: 'API keys are not configured' },
      { status: 500 }
    )
  }
  
  return NextResponse.json({
    auth: {
      apiKey: apiKeys.apiKey,
      secret: apiKeys.apiSecret,
      passphrase: apiKeys.apiPassphrase,
    }
  })
}

