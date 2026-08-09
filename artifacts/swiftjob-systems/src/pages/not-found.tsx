import { Link } from 'wouter';
import { ArrowLeft, ArrowUpRight, Compass } from 'lucide-react';
import { SiteLayout } from '@/components/site/SiteLayout';

export default function NotFound() {
  return (
    <SiteLayout
      title="Page Not Found — SwiftJob"
      description="The page you were looking for could not be found."
    >
      <div className="not-found-shell">
        <div className="container" style={{ textAlign: 'center', padding: '120px 0', maxWidth: 560 }}>
          <div className="not-found-icon" style={{ margin: '0 auto 28px', width: 72, height: 72, borderRadius: '50%', background: 'var(--pale)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}>
            <Compass size={30} style={{ color: 'var(--blue)' }} />
          </div>
          <h1 style={{ fontSize: 'clamp(2.6rem, 5vw, 3.6rem)', letterSpacing: '-.06em', lineHeight: 1, margin: '0 0 16px' }}>
            404 · Page not found
          </h1>
          <p style={{ color: 'var(--slate-ink)', lineHeight: 1.7, margin: '0 0 32px' }}>
            The page you're looking for may have moved or no longer exists. You can head back to the homepage or browse our open roles.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="button button-blue">
              <ArrowLeft size={16} /> Back to homepage
            </Link>
            <Link href="/careers" className="button button-dark">
              Browse open roles <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
