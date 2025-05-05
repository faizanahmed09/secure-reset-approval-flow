
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requestId = url.searchParams.get('requestId');
    
    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Checking approval status for request: ${requestId}`);
    
    // In a real implementation, you would:
    // 1. Query your database or Azure service to check the approval status
    // 2. Return the actual status of the approval request
    
    // For development/testing, we'll simulate a response based on time
    // In production, implement actual status checking logic
    const currentTime = Date.now();
    const reqTime = parseInt(requestId.split('_')[1]);
    const elapsedSeconds = (currentTime - reqTime) / 1000;
    
    let status = 'pending';
    
    // Simulate approval after 5 seconds
    if (elapsedSeconds > 5) {
      status = 'approved';
    }
    
    return NextResponse.json({
      requestId,
      status,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error checking approval status:', error);
    
    return NextResponse.json(
      { error: error.message || 'An error occurred while checking approval status' },
      { status: 500 }
    );
  }
}
