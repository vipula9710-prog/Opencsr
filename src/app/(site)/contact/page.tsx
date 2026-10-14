import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { issueFormToken } from "@/server/services/enquiries";
import { ContactForm } from "@/components/site/contact-form";
import { getSite } from "../site-data";
import { PageHero } from "../page-hero";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return { title: site?.site.config.pages.contact.title || "Contact", alternates: { canonical: "/contact" } };
}

export default async function ContactPage() {
  const site = await getSite();
  if (!site) notFound();
  const p = site.site.config.pages.contact;
  const c = site.contact;
  return (
    <>
      <PageHero title={p.title || "Contact us"} intro={p.intro} />
      <section className="section-pt-sm section-pb-md">
        <div className="site-container grid gap-10 @4xl:grid-cols-3">
          <address className="space-y-4 not-italic">
            {c.email ? <p><span className="block font-semibold">Email</span><a className="site-link" href={`mailto:${c.email}`}>{c.email}</a></p> : null}
            {c.phone ? <p><span className="block font-semibold">Phone</span>{c.phone}</p> : null}
            {c.address ? <p><span className="block font-semibold">Address</span><span className="whitespace-pre-line">{c.address}</span></p> : null}
          </address>
          <div className="@4xl:col-span-2">
            <ContactForm categories={site.organisation.enquiryCategories} token={issueFormToken(site.organisation.id)} />
          </div>
        </div>
      </section>
    </>
  );
}
