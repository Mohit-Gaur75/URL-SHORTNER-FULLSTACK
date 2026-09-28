const shortenBtn = document.getElementById("shortenBtn");
const longUrlInput = document.getElementById("longUrl");
const customCodeInput = document.getElementById("customCode");
const resultDiv = document.getElementById("result");
const shortUrlAnchor = document.getElementById("shortUrl");
const copyBtn = document.getElementById("copyBtn");

shortenBtn.addEventListener("click", async () => {
  const originalUrl = longUrlInput.value.trim();
  const customCode = customCodeInput.value.trim();

  if (!originalUrl) {
    alert("Please enter a URL");
    return;
  }

  try {
    const res = await fetch("https://url-shortner-backend-7v87.onrender.com/api/shorten", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ originalUrl, customCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Something went wrong");
      return;
    }

    const shortUrl = `https://url-shortner-backend-7v87.onrender.com/${data.shortCode}`;
    shortUrlAnchor.href = shortUrl;
    shortUrlAnchor.innerText = shortUrl;
    resultDiv.classList.remove("hidden");

  } catch (err) {
    alert("Server error");
  }
});

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(shortUrlAnchor.innerText);
  copyBtn.innerText = "Copied!";
  setTimeout(() => (copyBtn.innerText = "Copy"), 1500);
});

