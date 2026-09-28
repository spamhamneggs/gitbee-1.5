import type { Metadata } from "next";
import localFont from "next/font/local";
import { Montserrat, Outfit, Poppins } from "next/font/google";
import "./globals.css";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import MsalProviderWrapper from "./provider/MsalProviderWrapper";
import { AuthProvider } from "./context/AuthContext";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
  weight: "variable",
});
const montserrat = Montserrat({
  subsets: ["latin", "latin-ext"],
  variable: "--font-montserrat",
  weight: "variable",
  style: ["normal", "italic"],
});
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  variable: "--font-poppins",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "GitBee",
  description: "BINUS Project Gallery: Show the Best in Innovation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${montserrat.variable} ${poppins.variable} antialiased bg-gray-50`}
      >
        <AuthProvider>
          <MsalProviderWrapper>
            <Header />
            {children}
            <Footer />
          </MsalProviderWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
