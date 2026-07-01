export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4"
      data-testid="login-centering-root"
    >
      {children}
    </div>
  );
}
