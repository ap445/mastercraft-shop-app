import './globals.css';
import Link from 'next/link';
import BrandMark from './components/BrandMark';
export default function Home(){return <main className="shell"><div className="topbar"><div className="brand"><BrandMark />MASTERCRAFT SHOP MANAGEMENT</div></div><section className="hero"><div className="eyebrow">LIVE SHOP OPERATIONS</div><h1>Track jobs, materials, and time in one simple place.</h1><p>Set up your jobs and materials, then your team clocks in, picks the job they're on, and logs what they used — right from their phone.</p><div className="hero-actions"><Link className="btn primary" href="/login">SIGN IN</Link></div></section></main>}
