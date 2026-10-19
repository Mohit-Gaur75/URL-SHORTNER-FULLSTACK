import { useEffect, useRef, useState } from "react";

export default function CopyButton({ text, label = "Copy" }) {
  const [state, setState] = useState("idle"); // idle | copied | failed
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []); // don't update after unmount

  const copy = async () => {
    try {
      // Only works on https:// pages and on localhost; elsewhere it is refused.
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1500);
  };

  return (
    <button type="button" className="ghost" onClick={copy} aria-label={`${label} ${text}`}>
      {state === "copied" ? "Copied!" : state === "failed" ? "Copy failed" : label}
    </button>
  );
}
