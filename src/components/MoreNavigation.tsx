import { useEffect, useRef, useState } from "react";
import { translate as t } from "../i18n/language";
import Icon from "./Icon";
import { MORE_CATEGORIES, MORE_ITEMS, categoryForMoreSection } from "./moreSections";
import type { MoreSection } from "./moreSections";
import "./MoreNavigation.css";

interface Props {
  open: boolean;
  section?: MoreSection;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (section: MoreSection) => void;
}

function MoreMenu({ section, onSelect }: Pick<Props, "section" | "onSelect">) {
  const [category, setCategory] = useState(() => categoryForMoreSection(section));
  const submenu = useRef<HTMLDivElement>(null);
  const categories = useRef<HTMLDivElement>(null);

  return (
    <div id="more-menu" className="more-menu" role="group" aria-label={t("More")}>
      <div className="more-categories" ref={categories} role="group" aria-label={t("More categories")}>
        {MORE_CATEGORIES.map((item) => (
          <button type="button" key={item.id} aria-expanded={category.id === item.id} aria-controls="more-submenu"
            onPointerEnter={(event) => { if (event.pointerType === "mouse" && !submenu.current?.contains(document.activeElement)) setCategory(item); }}
            onClick={() => setCategory(item)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" && category.id === item.id) {
                event.preventDefault();
                submenu.current?.querySelector("button")?.focus();
              }
            }}>
            {t(item.label)}<Icon name="chevron" size={13} />
          </button>
        ))}
      </div>
      <div id="more-submenu" className="more-submenu" ref={submenu} role="group" aria-label={t(category.label)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft") return;
          event.preventDefault();
          categories.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
        }}>
        {category.groups.map((group) => (
          <section className="more-menu-group" key={group.label}>
            <h2><Icon name={group.icon} size={16} />{t(group.label)}</h2>
            {group.items.map((id) => {
              const item = MORE_ITEMS[id];
              return (
                <button key={id} type="button" aria-current={section === id ? "page" : undefined} onClick={() => onSelect(id)}>
                  <span>{t(item.label)}</span>
                  {"beta" in item && <span className="more-beta">Beta</span>}
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

export default function MoreNavigation({ open, section, onToggle, onClose, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) onClose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onClose();
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onClose]);

  return (
    <div className="home-navigation more-navigation" ref={container} onBlur={(event) => {
      if (open && !event.currentTarget.contains(event.relatedTarget)) onClose();
    }}>
      <button type="button" ref={trigger} className={open || section ? "active" : ""}
        aria-expanded={open} aria-controls="more-menu" onClick={onToggle}>{t("More")}</button>
      {open && <MoreMenu section={section} onSelect={(next) => { onSelect(next); trigger.current?.focus(); }} />}
    </div>
  );
}
