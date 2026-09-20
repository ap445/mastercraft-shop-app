import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
export async function GET(){ const session=await getSession(); return session ? NextResponse.json({user:session}) : NextResponse.json({error:'Unauthorized'},{status:401}); }
