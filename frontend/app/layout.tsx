import type { Metadata } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://erp-sand-eight-92.vercel.app";

const title = "School ERP & LMS";
const description =
  "A multi-tenant ERP and learning management platform for school operations, academics, attendance, examinations, fees, communication, and AI-assisted learning.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: title,
    template: `%s | ${title}`,
  },

  description,
  applicationName: title,

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "School ERP & LMS — School Operations in One Platform",
    description,
    url: "/",
    siteName: title,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og/school-erp-lms.png",
        width: 1200,
        height: 630,
        alt: "School ERP and LMS dashboard showcasing academic and administrative modules",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "School ERP & LMS — School Operations in One Platform",
    description,
    images: ["/og/school-erp-lms.png"],
  },

  robots: {
    index: true,
    follow: true,
  },
};