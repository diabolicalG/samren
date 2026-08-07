export default function AdminPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <p className="text-gray-400 mb-4">Administrator control panel.</p>
      <p className="text-sm text-gray-500">
        Access the full admin dashboard at{' '}
        <a
          href="http://localhost:3001"
          className="text-blue-400 hover:underline"
        >
          http://localhost:3001
        </a>
      </p>
    </div>
  );
}
