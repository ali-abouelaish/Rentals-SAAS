import { Urbanist } from "next/font/google";

/**
 * The public site and the sign-in "front door" are set in Urbanist, a stand-in for the brand's
 * Samsung Sharp Sans (which can't be licensed for the web). next/font self-hosts it at build, so
 * these pages make no runtime requests to Google. The scoped stylesheets read it through
 * `--font-urbanist` (see `--sans` in home.css, legal.css, not-found.css and door.css).
 */
export const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-urbanist",
  display: "swap",
});
