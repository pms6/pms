"use client";

/**
 * A form modal shouldn't vanish — losing everything typed into it — just
 * because a stray click landed on the dimmed area outside it.
 *
 * Wrap the modal's close handler with this on the backdrop element:
 *
 *   <div className="fixed inset-0 …" onClick={guardModalClose(onClose)}>
 *     <div onClick={(e) => e.stopPropagation()}> … the form … </div>
 *   </div>
 *
 * Explicit "Cancel" / X buttons keep calling `onClose` directly, so the
 * only path that now asks for confirmation is the accidental one — the
 * click outside the form.
 */
export const UNSAVED_CHANGES_PROMPT =
  "Are you sure you want to leave? Your entered data will be lost.";

export function guardModalClose(onClose, message = UNSAVED_CHANGES_PROMPT) {
  return (event) => {
    // A click that bubbled up from inside the dialog is not a dismissal.
    if (event && event.target !== event.currentTarget) return;
    if (typeof window !== "undefined" && !window.confirm(message)) return;
    onClose?.();
  };
}
