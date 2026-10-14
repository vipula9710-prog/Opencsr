"use client";

export default function SiteError({ reset }: { reset: () => void }) {
  return (
    <section className="section-pt-lg section-pb-lg">
      <div className="site-container text-center">
        <h1>Something went wrong</h1>
        <p className="mt-4">Please try again in a moment.</p>
        <button onClick={reset} className="site-btn site-btn-primary mt-8">Try again</button>
      </div>
    </section>
  );
}
