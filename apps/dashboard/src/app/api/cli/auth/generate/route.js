/**
 * CLI Authentication Code Generation API Route
 * 
 * This route handles the generation of CLI authentication codes
 * without requiring prior authentication. It forwards requests to the backend API.
 */

import { NextResponse } from 'next/server';

/**
 * POST handler for generating CLI authentication codes
 * 
 * @param {Request} request - The incoming request
 * @returns {Promise<NextResponse>} The response with the generated code
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, companyId } = body;

    // Validate required fields
    if (!userId || !companyId) {
      return NextResponse.json(
        { error: 'userId and companyId are required' },
        { status: 400 }
      );
    }

    // Forward request to backend API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/cli/auth/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, companyId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to generate code' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error generating CLI code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 