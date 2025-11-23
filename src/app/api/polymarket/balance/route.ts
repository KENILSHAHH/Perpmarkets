import { NextRequest, NextResponse } from 'next/server'

// Get API keys from environment variables
const getApiKeys = () => {
  return {
    apiKey: process.env.PM_API_KEY,
    apiSecret: process.env.PM_API_SECRET,
    apiPassphrase: process.env.PM_API_PASSPHRASE,
  }
}

// Similar to nitrolite: provide auth for WebSocket connection
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const authOnly = searchParams.get('auth') === 'true'
  
  if (authOnly) {
    // Return auth object for WebSocket connection
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

// Function to fetch balance from Polymarket API
// Similar to nitrolite pattern: async function that retrieves balance data
async function fetchBalance() {
  try {
    const apiKeys = getApiKeys()
    
    if (!apiKeys.apiKey || !apiKeys.apiSecret || !apiKeys.apiPassphrase) {
      throw new Error('API keys are not configured')
    }

    // Polymarket CLOB API endpoint for user balance
    // Note: Adjust this URL based on actual Polymarket API documentation
    // Possible endpoints:
    // - https://clob.polymarket.com/balance
    // - https://clob.polymarket.com/users/me/balance
    // - https://api.polymarket.com/v1/balance
    const url = 'https://clob.polymarket.com/balance'
    
    // Create authenticated request
    // Polymarket may require HMAC signing for authenticated endpoints
    // For now, using simple API key auth - adjust if HMAC is required
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-Key': apiKeys.apiKey,
        // Add other required headers for authentication if needed
      },
    })

    if (!response.ok) {
      // If 404, the endpoint might be different
      if (response.status === 404) {
        throw new Error('Balance endpoint not found. Please check Polymarket API documentation for the correct endpoint.')
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    // Extract balance from response (similar to nitrolite pattern of finding participant balance)
    // Polymarket API response structure may vary
    return data
  } catch (error) {
    console.error('[api] Error fetching balance:', error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    const balanceData = await fetchBalance()
    return NextResponse.json(balanceData)
  } catch (error) {
    console.error('[api] Error in balance route:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch balance',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

