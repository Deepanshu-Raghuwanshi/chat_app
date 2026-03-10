import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">Welcome to Chat App</h1>
      <p className="text-xl text-gray-600 mb-8 max-w-lg">
        Connect with friends and colleagues in real-time. Fast, secure, and easy to use.
      </p>
      <div className="flex gap-4">
        <Link 
          href="/login" 
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-semibold"
        >
          Login
        </Link>
        <Link 
          href="/signup" 
          className="px-6 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition font-semibold"
        >
          Sign Up
        </Link>
      </div>
    </main>
  );
}
