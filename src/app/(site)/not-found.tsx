export default function SiteNotFound() {
  return (
    <section className="section-pt-lg section-pb-lg">
      <div className="site-container text-center">
        <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--c-primary)" }}>404</p>
        <h1 className="mt-2">Page not found</h1>
        <p className="mx-auto mt-4 max-w-xl">The page you are looking for does not exist or is no longer published.</p>
        <a href="/" className="site-btn site-btn-primary mt-8">Go to the homepage</a>
      </div>
    </section>
  );
}
