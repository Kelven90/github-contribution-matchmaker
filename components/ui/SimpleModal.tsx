"use client";

import { ReactNode } from "react";

type SimpleModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function SimpleModal({ isOpen, title, onClose, children }: SimpleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4 border-b pb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded border px-2 py-1 text-sm">
            Close
          </button>
        </div>
        <div className="space-y-3 text-sm text-gray-700">{children}</div>
      </div>
    </div>
  );
}
