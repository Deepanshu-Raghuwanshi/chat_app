export const AnimatedBackground = () => {
  return (
    <>
      {/* Dark base background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />

      {/* Top left vibrant blue glow */}
      <div className="fixed -top-60 -left-60 w-96 h-96 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full opacity-40 blur-3xl -z-10" />

      {/* Top right vibrant purple glow */}
      <div className="fixed -top-40 -right-48 w-80 h-80 bg-gradient-to-bl from-purple-600 to-indigo-500 rounded-full opacity-35 blur-3xl -z-10" />

      {/* Center vibrant cyan accent */}
      <div className="fixed top-1/4 left-1/3 w-72 h-72 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full opacity-20 blur-3xl -z-10" />

      {/* Bottom right vibrant pink/purple glow */}
      <div className="fixed -bottom-48 -right-48 w-96 h-96 bg-gradient-to-tl from-pink-600 via-purple-500 to-purple-400 rounded-full opacity-35 blur-3xl -z-10" />

      {/* Bottom left vibrant teal glow */}
      <div className="fixed -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-teal-600 to-cyan-500 rounded-full opacity-25 blur-3xl -z-10" />

      {/* Grid pattern overlay */}
      <svg className="fixed inset-0 w-full h-full -z-10 opacity-10" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Radial gradient overlay for depth */}
      <div className="fixed inset-0 -z-10 bg-radial-gradient opacity-40" style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 0%, rgba(15, 23, 42, 0.8) 100%)'
      }} />
    </>
  );
};
