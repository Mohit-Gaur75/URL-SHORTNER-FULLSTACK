import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="container">
      <h1>Dashboard</h1>
      <p>Welcome, {user.name}. Your links will appear here.</p>
    </div>
  );
}