import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "A1.ai",
  description: "The Future of AI Starts Here.",
};

// Only colors, borders, and radii are overridden below — no height, padding,
// or max-height overrides. That keeps the card's overall size identical to
// Clerk's default (which already fits correctly on every form/screen size),
// so there's no scrollbar and no cut-off content.
const clerkAppearance = {
  variables: {
    colorPrimary: "#D4A94A",
    colorBackground: "#141414",
    colorText: "#f5f5f5",
    colorTextSecondary: "#a3a3a3",
    colorInputBackground: "#1f1f1f",
    colorInputText: "#f5f5f5",
    colorNeutral: "#f5f5f5",
    borderRadius: "10px",
    fontFamily: "var(--font-geist-sans)",
  },
  elements: {
    modalBackdrop: {
      backdropFilter: "blur(8px)",
      backgroundColor: "rgba(0,0,0,0.65)",
    },

    // Single card, single background, single border/shadow — no separate
    // sizing rules on card vs footer, so there's nothing to mismatch
    cardBox: {
  border: "1px solid rgba(212,169,74,0.18)",
  boxShadow: `
    0 30px 80px rgba(0,0,0,0.65),
    0 0 40px rgba(212,169,74,0.12),
    0 0 80px rgba(212,169,74,0.05)
  `,
},
    card: {
      backgroundColor: "#141414",
    },
    footer: {
      backgroundColor: "#141414",
      background: "#141414",
      boxShadow: "none",
    },
    footerAction: {
      backgroundColor: "#141414",
    },

    headerTitle: {
      color: "#f5f5f5",
      fontWeight: "700",
    },
    headerSubtitle: {
      color: "#a3a3a3",
    },

    modalCloseButton: {
      color: "#a3a3a3",
      "&:hover": { color: "#f5f5f5" },
    },

    socialButtonsBlockButton: {
      backgroundColor: "#1f1f1f",
      border: "1px solid rgba(255,255,255,0.1)",
      color: "#f5f5f5",
      "&:hover": {
        borderColor: "#D4A94A",
        backgroundColor: "#252525",
      },
    },
    socialButtonsBlockButtonText: {
      color: "#f5f5f5",
    },

    dividerLine: { backgroundColor: "rgba(255,255,255,0.1)" },
    dividerText: { color: "#737373" },

    formFieldLabel: { color: "#d4d4d4" },
    formFieldInput: {
      backgroundColor: "#1f1f1f",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "#f5f5f5",
      "&:focus": {
        borderColor: "#D4A94A",
        boxShadow: "0 0 0 3px rgba(212,169,74,0.2)",
      },
    },
    formFieldInputShowPasswordButton: { color: "#a3a3a3" },

    formButtonPrimary: {
      background: "linear-gradient(135deg, #D4A94A 0%, #b8903d 100%)",
      color: "#141414",
      fontWeight: "700",
      boxShadow: "0 4px 14px rgba(212,169,74,0.25)",
      "&:hover": {
        boxShadow: "0 8px 20px rgba(212,169,74,0.35)",
      },
    },

    footerActionText: { color: "#a3a3a3" },
    footerActionLink: {
      color: "#D4A94A",
      fontWeight: "600",
      "&:hover": { color: "#e0bb63" },
    },

    badge: {
      backgroundColor: "rgba(212,169,74,0.15)",
      color: "#D4A94A",
    },
    logoBox: { display: "none" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}