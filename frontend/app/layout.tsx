import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import RouteShell from "@/components/RouteShell";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
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
  },

  twitter: {
    card: "summary",
    title: "School ERP & LMS — School Operations in One Platform",
    description,
  },

  robots: {
    index: true,
    follow: true,
  },
};

const cachedThemeScript = `
(function () {
  try {
    var raw = localStorage.getItem("erp_school_branding_cache");
    if (!raw) return;

    var theme = JSON.parse(raw);

    var defaults = {
      primary_color: "#2563eb",
      secondary_color: "#0f172a",
      accent_color: "#22c55e",
      sidebar_color: "#0f172a",
      background_color: "#f8fafc",
      text_color: "#0f172a",
      border_radius: 16
    };

    theme = Object.assign(defaults, theme || {});

    function validHex(value, fallback) {
      return /^#[0-9a-f]{6}$/i.test(value || "")
        ? value
        : fallback;
    }

    function hexToRgb(hex) {
      hex = validHex(hex, defaults.primary_color).slice(1);

      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }

    function rgbToHex(r, g, b) {
      function clamp(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
      }

      return (
        "#" +
        [clamp(r), clamp(g), clamp(b)]
          .map(function (value) {
            return value.toString(16).padStart(2, "0");
          })
          .join("")
      );
    }

    function mix(hex, target, amount) {
      var rgb = hexToRgb(hex);
      var targetValue = target === "white" ? 255 : 0;

      return rgbToHex(
        rgb.r + (targetValue - rgb.r) * amount,
        rgb.g + (targetValue - rgb.g) * amount,
        rgb.b + (targetValue - rgb.b) * amount
      );
    }

    function readableTextColor(background) {
      var rgb = hexToRgb(background);

      var luminance =
        (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

      return luminance > 0.56 ? "#0f172a" : "#ffffff";
    }

    var root = document.documentElement;

    root.style.setProperty(
      "--erp-primary",
      validHex(theme.primary_color, defaults.primary_color)
    );

    root.style.setProperty(
      "--erp-primary-dark",
      mix(theme.primary_color, "black", 0.25)
    );

    root.style.setProperty(
      "--erp-primary-soft",
      mix(theme.primary_color, "white", 0.86)
    );

    root.style.setProperty(
      "--erp-primary-text",
      readableTextColor(theme.primary_color)
    );

    root.style.setProperty(
      "--erp-secondary",
      validHex(theme.secondary_color, defaults.secondary_color)
    );

    root.style.setProperty(
      "--erp-accent",
      validHex(theme.accent_color, defaults.accent_color)
    );

    root.style.setProperty(
      "--erp-sidebar",
      validHex(theme.sidebar_color, defaults.sidebar_color)
    );

    root.style.setProperty(
      "--erp-sidebar-active",
      mix(theme.primary_color, "black", 0.35)
    );

    root.style.setProperty(
      "--erp-background",
      validHex(theme.background_color, defaults.background_color)
    );

    root.style.setProperty(
      "--erp-text",
      validHex(theme.text_color, defaults.text_color)
    );

    root.style.setProperty(
      "--erp-border-radius",
      (Number(theme.border_radius) || defaults.border_radius) + "px"
    );

    root.style.setProperty(
      "--background",
      validHex(theme.background_color, defaults.background_color)
    );

    root.style.setProperty(
      "--foreground",
      validHex(theme.text_color, defaults.text_color)
    );
  } catch (error) {
    // Use the default theme if cached branding cannot be loaded.
  }
})();
`;

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="erp-cached-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: cachedThemeScript,
          }}
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