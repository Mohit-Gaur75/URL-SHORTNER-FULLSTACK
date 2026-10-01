import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Log in</h1>
      <form onSubmit={handleSubmit}>
        <input name="email" type="email" placeholder="Email"
               value={form.email} onChange={handleChange} required />
        <input name="password" type="password" placeholder="Password"
               value={form.password} onChange={handleChange} required />
        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      <p className="hint">No account? <Link to="/register">Register</Link></p>
    </div>
  );
}
