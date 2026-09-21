import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request) {
  try {
    const auth = await requireSession(['admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const formData = await request.formData();
    const guidanceId = formData.get('guidanceId');
    const file = formData.get('file');
    if (!guidanceId) return NextResponse.json({ error: 'Save this expectation before attaching documents.' }, { status: 400 });
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Choose a file to attach.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Files must be 15MB or smaller.' }, { status: 400 });
    const guidanceR = await query('select id from daily_guidance where id=$1', [guidanceId]);
    if (!guidanceR.rows[0]) return NextResponse.json({ error: 'That expectation could not be found.' }, { status: 404 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const r = await query(
      `insert into guidance_attachments(guidance_id,filename,content_type,file_size,file_data)
       values ($1,$2,$3,$4,$5) returning id,filename,content_type,file_size,uploaded_at`,
      [guidanceId, file.name || 'attachment', file.type || 'application/octet-stream', buffer.length, buffer]
    );
    return NextResponse.json({ attachment: r.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unable to upload attachment.' }, { status: 500 });
  }
}
