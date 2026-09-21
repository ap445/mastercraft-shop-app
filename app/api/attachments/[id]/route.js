import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function GET(request, { params }) {
  try {
    const auth = await requireSession(['employee', 'supervisor', 'admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const r = await query('select filename,content_type,file_data from guidance_attachments where id=$1', [id]);
    const row = r.rows[0];
    if (!row) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
    return new NextResponse(row.file_data, {
      headers: {
        'Content-Type': row.content_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${String(row.filename || 'attachment').replace(/"/g, '')}"`,
        'Cache-Control': 'private, max-age=0, no-cache'
      }
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unable to fetch attachment.' }, { status: 500 });
  }
}
