import NextAuth from "next-auth";
import authConfig from "./auth.config";

// Edge runtime: use the edge-safe config only (no database code).
const { auth } = NextAuth(authConfig);

/**
 * First line of defence: send signed-out visitors to /signin.
 * Pages and API routes also check the session themselves (lib/auth.ts), so this
 * is never the only thing protecting data.
 */
export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/signin", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(url);
  }
});

export const config = { matcher: ["/courses/:path*", "/join/:path*"] };
