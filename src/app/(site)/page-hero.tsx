export function PageHero({ title, intro, eyebrow }: { title: string; intro?: string | null; eyebrow?: string }) {
  return (
    <section className="section-pt-md section-pb-sm" style={{ background: "var(--c-surface-alt)" }}>
      <div className="site-container">
        {eyebrow ? <p className="mb-2 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--c-primary)" }}>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {intro ? <p className="mt-4 max-w-3xl text-lg">{intro}</p> : null}
      </div>
    </section>
  );
}
