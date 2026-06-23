export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <img src="/images/logo.png" alt="Webdura" className="mb-3 h-10 w-auto" />
          <h1 className="text-xl font-semibold">Hiring Tracker</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
