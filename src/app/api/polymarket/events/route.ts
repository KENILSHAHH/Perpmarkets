import { NextRequest, NextResponse } from 'next/server'

// Get API keys from environment variables
const getApiKeys = () => {
  return {
    apiKey: process.env.PM_API_KEY,
    apiSecret: process.env.PM_API_SECRET,
    apiPassphrase: process.env.PM_API_PASSPHRASE,
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json(
      { error: 'Slug parameter is required' },
      { status: 400 }
    )
  }

  try {
    const url = `https://gamma-api.polymarket.com/events/slug/${slug}`
    
    // Get API keys (currently not needed for public endpoints, but available if needed)
    const apiKeys = getApiKeys()
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        // Add authentication headers if API keys are available and needed
        ...(apiKeys.apiKey && {
          'X-API-Key': apiKeys.apiKey,
        }),
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP error! status: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[api] Error proxying Polymarket request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event data' },
      { status: 500 }
    )
  }
}

