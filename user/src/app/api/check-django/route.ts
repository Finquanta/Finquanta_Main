import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Try to connect to Django server
    const response = await fetch('http://localhost:8000/admin/', {
      method: 'GET',
    });
    
    const status = response.status;
    const ok = response.ok;
    
    // Get response text (don't try to parse as JSON)
    const text = await response.text();
    
    return NextResponse.json({
      message: 'Django connection test',
      djangoStatus: status,
      djangoResponseOk: ok,
      responseLength: text.length,
      responsePreview: text.substring(0, 100) + '...',
    });
  } catch (error) {
    console.error('Error connecting to Django:', error);
    return NextResponse.json({
      message: 'Failed to connect to Django backend',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
} 