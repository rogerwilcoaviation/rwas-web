import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(req) {
    // Protected routes
    if (
      req.nextUrl.pathname.startsWith('/dashboard') ||
      req.nextUrl.pathname.startsWith('/api/dashboard')
    ) {
      // Redirect to signin if not authenticated
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
