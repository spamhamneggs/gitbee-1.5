import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  if (!token) {
    return NextResponse.redirect(new URL("/login/microsoft", req.url));
  }

  try {
    const decoded = jwt.decode(token) as { role?: string[] };
    if (!decoded?.role || !Array.isArray(decoded.role)) {
      return NextResponse.redirect(new URL("/login/microsoft", req.url));
    }

    const roles = decoded.role.map((r) => r.toLowerCase());
    console.log("User roles:", roles);

    const roleBasedAccess: Record<string, RegExp[]> = {
      student: [/^\/dashboard/, /^\/course/, /^\/profile/],
      lecturer: [
        /^\/dashboard-lecturer/,
        /^\/course-lecturer/,
        /^\/history-lecturer/,
      ],
      scc: [/^\/dashboard-scc/],
      hop: [/^\/dashboard-hop/],
      admin: [
        /^\/dashboard-admin/,
        /^\/detail-admin-project/,
        /^\/manage-categories/,
        /^\/manage-student/,
        /^\/manage-transactions/,
        /^\/manage-users/,
      ],
    };

    const isAllowed = Object.entries(roleBasedAccess).some(
      ([role, paths]) =>
        roles.includes(role) && paths.some((regex) => regex.test(pathname))
    );

    console.log(isAllowed);
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/login/microsoft", req.url));
    }
  } catch (error) {
    return NextResponse.redirect(new URL("/login/microsoft", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/course/:path*",
    "/dashboard/:path*",
    "/profile",
    "/course-lecturer/:path*",
    "/dashboard-lecturer/:path*",
    "/history-lecturer/:path*",
    "/dashboard-scc/:path*",
    "/dashboard-hop/:path*",
    "/dashboard-admin/:path*",
    "/detail-admin-project/:path*",
    "/manage-categories/:path*",
    "/manage-student/:path*",
    "/manage-transactions/:path*",
    "/manage-users/:path*",
  ],
};
