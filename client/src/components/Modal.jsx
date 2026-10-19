import { useEffect, useRef } from "react";

// A pop-up built on the browser's own <dialog> element. The browser provides
// the hard parts for free: it traps keyboard focus inside, closes on Escape, and
// dims and blocks the page behind it.
//
// Children are only rendered while the modal is open, so each time it opens the
// form inside starts fresh.
export default function Modal({ open, title, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onClose={onClose} // fires on Escape and on dialog.close()
      onClick={(event) => event.target === ref.current && onClose()} // a click on the dimmed backdrop
    >
      {open && (
        <div className="modal-body">
          <h2 id="modal-title">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
