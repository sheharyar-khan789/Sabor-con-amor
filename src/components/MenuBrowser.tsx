"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { printedMenuImage } from "@/data/menu";
import type { MenuConfig } from "@/lib/config/business-config";
import Icon from "./Icon";
import { useDialog } from "./useDialog";

// "View menus" for the booking forms (customer online request and admin
// offline booking). Lists EVERY menu it is given (the same configured menus
// as the form's Menu list), each with its configured dishes and, when one
// exists, its own section of the real printed menu card. Browsing changes
// nothing in the form; "Choose this menu" only sets the menu field.

export default function MenuBrowser({
  menus,
  selectedId,
  onSelect,
  locked = false,
}: {
  menus: MenuConfig[];
  selectedId: string;
  /** Sets the form's menu field. Not offered while a package decides the menu. */
  onSelect: (id: string) => void;
  /** True while the selected package includes a menu (the Menu list is disabled). */
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setZoom(null);
    setOpen(false);
  }, []);
  const closeRef = useDialog(open, close, dialogRef);
  // Opening a menu scrolls the selected one into view.
  useEffect(() => {
    if (!open || !selectedId) return;
    const raf = requestAnimationFrame(() => dialogRef.current?.querySelector(`[data-menu-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(raf);
  }, [open, selectedId]);

  if (menus.length === 0) return null;
  const items = (m: MenuConfig) => m.items.filter((i) => i.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const zoomMenu = zoom ? menus.find((m) => m.id === zoom) ?? null : null;
  const zoomImage = zoomMenu ? printedMenuImage(zoomMenu) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="mt-2 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
        <Icon name="doc" className="h-4 w-4 text-gold" />
        View menus ({menus.length})
      </button>
      {open &&
        // Only after a click, so document exists (never during server rendering).
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-end justify-center bg-noir/70 sm:items-center sm:p-6" onClick={close}>
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menus"
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-surface text-ink shadow-2xl sm:rounded-2xl"
            >
              <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <p className="text-eyebrow font-semibold uppercase text-gold">{zoomMenu ? "Printed menu card" : `${menus.length} menus`}</p>
                  <p className="truncate font-display text-xl">{zoomMenu ? zoomMenu.name : "Menus"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {zoomImage && (
                    <a href={zoomImage.src} target="_blank" rel="noopener" aria-label={`Open ${zoomMenu!.name} printed card at full size in a new tab`} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-high">
                      <Icon name="expand" className="h-5 w-5" />
                    </a>
                  )}
                  <button ref={closeRef} type="button" onClick={close} aria-label="Close menus" className="grid h-11 w-11 place-items-center rounded-full border border-line hover:bg-surface-high">
                    <Icon name="close" className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {zoomMenu && zoomImage ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4 sm:p-6">
                  <button type="button" onClick={() => setZoom(null)} className="inline-flex min-h-[44px] items-center gap-2 self-start text-sm font-semibold text-ink-soft hover:text-ink">
                    <Icon name="prev" className="h-4 w-4" />
                    Back to all menus
                  </button>
                  <Image
                    src={zoomImage.src}
                    width={zoomImage.width}
                    height={zoomImage.height}
                    sizes="(min-width: 1024px) 960px, 100vw"
                    alt={`Printed menu card: ${zoomMenu.name}`}
                    className="h-auto w-full rounded-lg ring-1 ring-line"
                  />
                </div>
              ) : (
                <ul className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 sm:p-6 md:grid-cols-2">
                  {menus.map((m) => {
                    const img = printedMenuImage(m);
                    const dishes = items(m);
                    const selected = m.id === selectedId;
                    return (
                      <li key={m.id} data-menu-id={m.id} className={`flex flex-col rounded-xl border p-4 ${selected ? "border-gold ring-1 ring-gold" : "border-line"}`}>
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-display text-xl leading-tight">{m.name}</h3>
                          {selected && <span className="shrink-0 text-xs font-semibold uppercase text-gold">Selected</span>}
                        </div>
                        {img && !failed.has(img.src) && (
                          <button type="button" onClick={() => setZoom(m.id)} aria-label={`View the printed menu card for ${m.name}`} className="group relative mt-3 block overflow-hidden rounded-lg bg-surface-high ring-1 ring-line">
                            <Image
                              src={img.src}
                              width={img.width}
                              height={img.height}
                              sizes="(min-width: 768px) 460px, 92vw"
                              alt={`Printed menu card: ${m.name}`}
                              onError={() => setFailed((f) => new Set(f).add(img.src))}
                              className="h-auto w-full"
                            />
                            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-md bg-noir/80 px-2.5 py-1 text-xs font-medium text-white">
                              <Icon name="expand" className="h-3.5 w-3.5 text-gold-light" />
                              Enlarge
                            </span>
                          </button>
                        )}
                        {dishes.length > 0 ? (
                          <ul className="mt-3 flex-1 space-y-1 text-sm text-ink-soft">
                            {dishes.map((d) => (
                              <li key={d.id}>{d.name}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 flex-1 text-sm text-ink-muted">No dish list has been entered for this menu yet.</p>
                        )}
                        {m.description && <p className="mt-2 text-xs text-ink-muted">{m.description}</p>}
                        {!locked && (
                          <button
                            type="button"
                            disabled={selected}
                            onClick={() => {
                              onSelect(m.id);
                              close();
                            }}
                            className="btn btn-outline btn-sm mt-4 self-start disabled:opacity-60"
                          >
                            {selected ? "Selected" : "Choose this menu"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {locked && !zoomMenu && <p className="border-t border-line px-5 py-3 text-xs text-ink-muted">The selected package includes its menu, so it cannot be changed here.</p>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
