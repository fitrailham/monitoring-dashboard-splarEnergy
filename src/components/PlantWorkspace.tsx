import { useState } from "react";
import { translate as t } from "../i18n/language";
import type { Plant } from "../services/fleet";
import DeviceManagement from "./DeviceManagement";
import Icon from "./Icon";
import PlantManagement from "./PlantManagement";
import { PLANT_WORKSPACE_GROUPS } from "./plantWorkspaceSections";
import type { PlantWorkspaceSection } from "./plantWorkspaceSections";

interface Props {
  section: PlantWorkspaceSection;
  onSectionChange: (section: PlantWorkspaceSection) => void;
  plants: Plant[];
  loading: boolean;
  selected: string;
  onPlantChange: (code: string) => void;
  onPlantSelect: (plant: Plant) => void;
  onPlantAdd?: () => void;
  onPlantEdit?: (plant: Plant) => void;
  onMonitoring: () => void;
  refreshKey: number;
}

export default function PlantWorkspace({
  section, onSectionChange, plants, loading, selected, onPlantChange,
  onPlantSelect, onPlantAdd, onPlantEdit, onMonitoring, refreshKey,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const group = PLANT_WORKSPACE_GROUPS.find((item) => item.items.some((entry) => entry.id === section)) ?? PLANT_WORKSPACE_GROUPS[0];
  const label = group.items.find((entry) => entry.id === section)?.label;
  const plant = plants.find((item) => item.plant_code === selected) ?? plants[0];

  return (
    <div className={`plant-workspace${collapsed ? " plant-workspace-collapsed" : ""}`}>
      <aside className="plant-section-sidebar">
        <h1><Icon name={group.icon} size={19} /><span>{t(group.label)}</span></h1>
        <nav id="plant-workspace-sections" aria-label={t(group.label)} hidden={collapsed}>
          {group.items.map((item) => (
            <button type="button" key={item.id} aria-current={section === item.id ? "page" : undefined}
              onClick={() => onSectionChange(item.id)}>
              {t(item.label)}
            </button>
          ))}
        </nav>
        <button type="button" className="plant-sidebar-toggle" aria-expanded={!collapsed} aria-controls="plant-workspace-sections"
          aria-label={t(collapsed ? "Expand plant navigation" : "Collapse plant navigation")} onClick={() => setCollapsed(!collapsed)}>
          <Icon name="chevron" size={14} />
        </button>
      </aside>
      <div className="plant-workspace-content">
        {section === "plant-management" && <PlantManagement plants={plants} loading={loading}
          onAdd={onPlantAdd} onEdit={onPlantEdit} onSelect={onPlantSelect} />}
        {section === "device-management" && (
          <section className="plant-device-workspace" aria-labelledby="plant-device-title">
            <header>
              <h2 id="plant-device-title">{t("Device Management")}</h2>
              <label>{t("Plant")}
                <select aria-label={t("Plant")} value={plant?.plant_code ?? ""} disabled={!plants.length} onChange={(event) => onPlantChange(event.target.value)}>
                  {!plants.length && <option value="">{loading ? t("Loading plants…") : t("No plants yet")}</option>}
                  {plants.map((item) => <option key={item.plant_code} value={item.plant_code}>{item.plant_name}</option>)}
                </select>
              </label>
            </header>
            <DeviceManagement key={plant?.plant_code} plant={plant} refreshKey={refreshKey} onOverview={onMonitoring} />
          </section>
        )}
        {section !== "plant-management" && section !== "device-management" && (
          <section className="plant-unavailable-panel" aria-labelledby="plant-section-title">
            <h2 id="plant-section-title">{t(label)}</h2>
            <div>
              <Icon name={group.icon} size={32} />
              <p role="status">{t("This feature is awaiting backend integration.")}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
