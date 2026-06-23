import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const isAuthRoute = url.pathname.startsWith("/login")
    || url.pathname.startsWith("/signup")
    || url.pathname.startsWith("/forgot-password")
    || url.pathname.startsWith("/reset-password")
    || url.pathname.startsWith("/auth");
  const isPublicRoute = url.pathname.startsWith("/public") || url.pathname === "/";

  if (!user && !isAuthRoute && !isPublicRoute) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute && !url.pathname.startsWith("/auth/callback")) {
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
