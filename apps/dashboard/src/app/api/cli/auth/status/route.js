/**
 * CLI Authentication Status Check API Route
 * 
 * This route handles checking the status of CLI authentication codes
 * without requiring prior authentication. It forwards requests to the backend API.
 */

import { NextResponse } from 'next/server';

/**
 * POST handler for checking CLI authentication status
 * 
 * @param {Request} request - The incoming request
 * @returns {Promise<NextResponse>} The response with the status information
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { code } = body;

    // Validate required fields
    if (!code) {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      );
    }

    // Forward request to backend API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/cli/auth/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to check status' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking CLI status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 