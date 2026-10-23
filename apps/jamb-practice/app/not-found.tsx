import { A as Link } from '@/components/A';

export default function NotFound() {
  return (
    <main id="main">
      <div className="wrap">
        <h1>Page not found</h1>
        <p>This page does not exist. Check the link, or start from the beginning.</p>
        <Link href="/" className="btn">
          Go to the start
        </Link>
      </div>
    </main>
  );
}
