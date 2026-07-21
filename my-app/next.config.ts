import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required as of Next.js 16.x: dev-only assets/endpoints (JS chunks, HMR,
  // RSC payloads) are blocked by default for any origin other than
  // localhost. Without this, opening the app on a phone via the LAN IP
  // shown in the terminal loads a blank/white page — the initial HTML
  // request succeeds, but every follow-up request needed to render and
  // hydrate the page gets a silent 403.
  //
  // Replace the value below with the exact IP printed after "Network:"
  // when you run `npm run dev` — no http://, no port, just the bare IP
  // (e.g. "192.168.1.42"). If your machine's IP changes later (new
  // network, router reassigns it), update this value and restart the dev
  // server, or the phone will show a white page again.
  allowedDevOrigins: ["192.168.1.149"], // <-- replace with YOUR terminal's IP
};

export default nextConfig;