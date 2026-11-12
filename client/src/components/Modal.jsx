import { useEffect, useRef } from "react";

export default function Modal({ open, isOpen, title, onClose, children }) {
  const isModalOpen = Boolean(open ?? isOpen);
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isModalOpen && !dialog.open) dialog.showModal();
    if (!isModalOpen && dialog.open) dialog.close();
  }, [isModalOpen]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
    >
      {isModalOpen && (
        <div className="modal-body">
          <div className="modal-header">
            <h2 id="modal-title" className="modal-title">
              {title}
            </h2>
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              aria-label="Close dialog"
              style={{ border: "none", background: "none", padding: "4px" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
