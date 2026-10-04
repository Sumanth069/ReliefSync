import { NextRequest, NextResponse } from 'next/server';
import { SyncPullResponse } from '@/lib/types';
import { getServerChangeLog } from '@/lib/serverStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get('since');
    const since = sinceParam ? parseInt(sinceParam, 10) : 0;

    const { changes, nextSeq } = getServerChangeLog(isNaN(since) ? 0 : since);

    const response: SyncPullResponse = {
      changes,
      nextSeq,
      hasMore: false,
      serverTime: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error('Error handling /api/sync/pull:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
