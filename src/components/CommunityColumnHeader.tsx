import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IHeaderParams } from "ag-grid-community";

// Only replace the inner label. AG Grid retains its header, sorting, drag/resize,
// keyboard navigation, and sort indicators around this component.
export default function CommunityColumnHeader(params: IHeaderParams) {
  const { api, column, displayName, eGridHeader, enableSorting, setSort, showFilter } = params;
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [chooseColumns, setChooseColumns] = useState(false);
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setChooseColumns(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    column.addEventListener("filterActiveChanged", refresh);
    column.addEventListener("sortChanged", refresh);
    api.addEventListener("columnVisible", refresh);
    api.addEventListener("columnPinned", refresh);
    return () => {
      column.removeEventListener("filterActiveChanged", refresh);
      column.removeEventListener("sortChanged", refresh);
      api.removeEventListener("columnVisible", refresh);
      api.removeEventListener("columnPinned", refresh);
    };
  }, [api, column]);

  useEffect(() => {
    if (!open) return;
    popup.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !popup.current?.contains(event.target) && !trigger.current?.contains(event.target)) close();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    }
    function scroll(event: Event) {
      if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) close();
    }
    function resize() { close(); }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [open, close]);

  const activeFilter = column.isFilterActive();
  const definition = column.getColDef();
  const rect = open ? anchorRect : null;
  const width = Math.min(240, window.innerWidth - 16);
  const above = rect ? rect.bottom > window.innerHeight / 2 : false;
  const left = rect ? Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)) : 8;
  const maxHeight = rect ? Math.max(80, above ? rect.top - 12 : window.innerHeight - rect.bottom - 12) : 400;

  function action(label: string, run: () => void, disabled = false) {
    return <button type="button" role="menuitem" disabled={disabled} onClick={() => {
      close(true);
      if (!api.isDestroyed()) run();
    }}>{label}</button>;
  }

  return <>
    <span>{displayName}</span>
    {createPortal(<button
      ref={trigger}
      type="button"
      className={`community-header-menu-button${activeFilter ? " filter-active" : ""}`}
      aria-label={`Column Menu: ${displayName}${activeFilter ? " (filter aktif)" : ""}`}
      title={`${displayName}${activeFilter ? " · Filter aktif" : ""} · Column Menu`}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setAnchorRect(event.currentTarget.getBoundingClientRect());
        setOpen(!open);
        setChooseColumns(false);
      }}
      onKeyDownCapture={(event) => {
        event.stopPropagation();
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setAnchorRect(event.currentTarget.getBoundingClientRect());
          setOpen(true);
        }
      }}
    ><span aria-hidden="true">⋮</span></button>, eGridHeader)}
    {open && rect && createPortal(<div
      ref={popup}
      id={menuId}
      className="community-column-menu"
      role="menu"
      aria-label={`Column Menu: ${displayName}`}
      style={{ width, left, maxHeight, ...(above ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }) }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) close();
      }}
      onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
          (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}
    >
      {column.isFilterAllowed() && <>
        <button type="button" role="menuitem" onClick={() => {
          const anchor = trigger.current;
          close();
          if (anchor && !api.isDestroyed()) showFilter(anchor);
        }}>Column Filter</button>
        <div className="community-menu-separator" role="separator" />
      </>}
      {enableSorting && <>
        {action("Sort Ascending", () => setSort("asc"))}
        {action("Sort Descending", () => setSort("desc"))}
        {action("Clear Sort", () => setSort(null), !column.getSort())}
        <div className="community-menu-separator" role="separator" />
      </>}
      {action("Pin Left", () => api.setColumnsPinned([column], "left"), Boolean(definition.lockPinned) || column.isPinnedLeft())}
      {action("Pin Right", () => api.setColumnsPinned([column], "right"), Boolean(definition.lockPinned) || column.isPinnedRight())}
      {action("Unpin Column", () => api.setColumnsPinned([column], null), Boolean(definition.lockPinned) || !column.isPinned())}
      <div className="community-menu-separator" role="separator" />
      {action("Autosize This Column", () => api.autoSizeColumns([column]), Boolean(definition.suppressAutoSize))}
      {action("Autosize All Columns", () => api.autoSizeAllColumns())}
      <button type="button" role="menuitem" aria-expanded={chooseColumns} onClick={() => setChooseColumns(!chooseColumns)}>Choose Columns</button>
      {chooseColumns && <div className="community-menu-columns" role="group" aria-label="Kolom yang ditampilkan">
        {api.getColumns()?.map((item) => <button
          key={item.getColId()}
          type="button"
          role="menuitemcheckbox"
          aria-checked={item.isVisible()}
          disabled={Boolean(item.getColDef().lockVisible)}
          onClick={() => api.setColumnsVisible([item], !item.isVisible())}
        ><span aria-hidden="true">{item.isVisible() ? "✓" : ""}</span>{api.getDisplayNameForColumn(item, "header")}</button>)}
      </div>}
      {action("Reset Columns", () => api.resetColumnState())}
    </div>, document.body)}
  </>;
}
