import type { Metadata } from 'next';
import { A as Link } from '@/components/A';
import { Diagnostic } from '@/components/Diagnostic';
import { Page } from '@/components/Shell';
import { Track } from '@/components/Track';
import { servableDiagnostic } from '@/lib/content';
import { toPublicQuestion } from '@/lib/contentStore';

export const metadata: Metadata = { title: 'Free 5-minute check' };

export default async function CheckPage() {
  const diag = servableDiagnostic();
  return (
    <Page>
      <Track />
      <h1>Free 5-minute check</h1>
      {diag ? (
        <Diagnostic
          // Answers stay on the server; the browser only needs the questions.
          questions={diag.questions.map((q) => {
            const { answer: _a, explanation: _e, ...rest } = toPublicQuestion(q);
            return rest;
          })}
        />
      ) : (
        <>
          <p>The check is being prepared by our teacher and will be ready shortly.</p>
          <Link href="/" className="btn btn-secondary">
            Back to the start
          </Link>
        </>
      )}
    </Page>
  );
}
