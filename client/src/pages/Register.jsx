import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Create account</h1>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Name"
               value={form.name} onChange={handleChange} required />
        <input name="email" type="email" placeholder="Email"
               value={form.email} onChange={handleChange} required />
        <input name="password" type="password" placeholder="Password (min 8 characters)"
               value={form.password} onChange={handleChange} minLength={8} required />
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Register"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      <p className="hint">Already registered? <Link to="/login">Log in</Link></p>
    </div>
  );
}
