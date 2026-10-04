import { NextRequest, NextResponse } from 'next/server';
import { SyncPushRequest, SyncPushResponse, OpResultItem } from '@/lib/types';
import { processServerOp } from '@/lib/serverStore';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SyncPushRequest;
    if (!body || !Array.isArray(body.ops)) {
      return NextResponse.json({ error: 'Invalid push request format' }, { status: 400 });
    }

    const results: OpResultItem[] = [];

    // Process each op transactionally
    for (const op of body.ops) {
      const outcome = processServerOp(op);
      results.push(outcome);
    }

    const response: SyncPushResponse = {
      results,
      serverTime: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error('Error handling /api/sync/push:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
