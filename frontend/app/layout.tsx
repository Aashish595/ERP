import type { Metadata } from "next";
import Script from "next/script";
import RouteShell from "@/components/RouteShell";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://erp-sand-eight-92.vercel.app";

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
        alt: "School ERP and LMS dashboard",
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

const cachedThemeScript = `
  // Keep your complete existing cached theme script here.
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="erp-cached-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: cachedThemeScript }}
        />

        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
      </head>

      <body suppressHydrationWarning>
        <RouteShell>{children}</RouteShell>
      </body>
    </html>
  );
}