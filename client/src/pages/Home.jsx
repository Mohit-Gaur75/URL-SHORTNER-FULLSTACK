import LinkForm from "../components/LinkForm";

export default function Home() {
  return (
    <div className="container">
      <h1>🔗 URL Shortener</h1>
      <p>Paste your long URL below</p>
      <LinkForm />
    </div>
  );
}