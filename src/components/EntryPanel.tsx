import { useEffect, useRef, type ReactNode } from 'react';

export default function EntryPanel({ children, labelledBy, onClose, returnFocusTo }: {
  children: ReactNode;
  labelledBy: string;
  onClose(): void;
  returnFocusTo?: HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const opener = returnFocusTo || document.activeElement as HTMLElement | null;
    const media = window.matchMedia('(max-width: 760px)');
    function show() {
      if (element.open) element.close();
      if (media.matches) element.showModal();
      else element.show();
    }
    show();
    media.addEventListener('change', show);
    return () => {
      media.removeEventListener('change', show);
      element.close();
      if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus({ preventScroll: true });
    };
  }, [returnFocusTo]);
  return <dialog ref={dialog} className="character-panel" aria-labelledby={labelledBy}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
    {children}
  </dialog>;
}
