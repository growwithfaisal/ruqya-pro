"use client";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

/** The app's slide-over: a bottom sheet on phones, a right panel from 768px. Same look as the citation drawer. */
export function Sheet({
  open, onOpenChange, title, description, children,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay fixed inset-0 z-40 bg-black/45" />
        <Dialog.Content
          className="drawer-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col glass-strong rounded-t-[28px] border border-line text-card-ink shadow-[0_-16px_48px_-16px_rgb(0_0_0/0.4)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[28rem] md:rounded-l-[28px] md:rounded-tr-none"
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
            <div>
              <Dialog.Title className="display text-[1.5rem] leading-tight">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-[0.95rem] text-card-soft">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="min-h-11 shrink-0 rounded-full border border-line px-4 text-[0.9rem]">Close</Dialog.Close>
          </div>
          <div className="overflow-y-auto px-6 pb-8">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
