import { useState } from "react";
import { LANGUAGES, translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import type { Plant } from "../services/fleet";
import type { DashboardOverview } from "../services/portfolio";
import AlarmManagement from "./AlarmManagement";
import type { AlarmSummary } from "./FleetSummary";
import Icon from "./Icon";
import MoreRealTimeStatus from "./MoreRealTimeStatus";
import { MORE_ITEMS, categoryForMoreSection } from "./moreSections";
import type { MoreSection } from "./moreSections";
import type { PlantWorkspaceSection } from "./plantWorkspaceSections";
import "./MoreWorkspace.css";

interface Props {
  section: MoreSection;
  onSectionChange: (section: MoreSection) => void;
  plants: Plant[];
  loading: boolean;
  selected: string;
  onPlantChange: (code: string) => void;
  onPlantSelect: (plant: Plant) => void;
  onOpenPlantSection: (section: PlantWorkspaceSection) => void;
  now: number;
  refreshKey: number;
  alarms: AlarmSummary;
  summary: DashboardOverview | null;
  displayName: string;
}

function EmptyTable({ columns, message }: { columns: string[]; message: string }) {
  return (
    <div className="more-workspace-table" role="region" aria-label={t(columns[0])} tabIndex={0}>
      <table className="more-data-table">
        <thead><tr>{columns.map((column) => <th key={column} scope="col">{t(column)}</th>)}</tr></thead>
        <tbody><tr><td className="more-table-message" colSpan={columns.length}><p role="status"><Icon name="info" size={22} />{t(message)}</p></td></tr></tbody>
      </table>
    </div>
  );
}

function CompanyManagement() {
  const tabs = ["User Management", "Company Info", "Mailbox", "Default Electricity Prices", "Task Approval"];
  const [tab, setTab] = useState(tabs[0]);

  return (
    <div className="more-split">
      <aside className="more-workspace-side" aria-label={t("Company Management")}>
        <h1><Icon name="building" size={19} />{t("Company Management")}</h1>
        <label className="more-company-search">
          <Icon name="search" size={15} />
          <input type="search" disabled placeholder={t("Enter a company name")} aria-label={t("Enter a company name")} />
        </label>
        <p>{t("The company list is unavailable.")}</p>
      </aside>
      <section className="more-card" aria-label={t("Company Management")}>
        <header className="more-card-heading">
          <h2>{t("Companies")}</h2>
          <div className="more-actions">
            <button type="button" className="primary" disabled>{t("Add Company")}</button>
            <button type="button" className="outline" disabled>{t("Delete Company")}</button>
          </div>
        </header>
        <nav className="more-workspace-tabs" aria-label={t("Company management sections")}>
          {tabs.map((item) => <button type="button" key={item} aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}>{t(item)}</button>)}
        </nav>
        {tab === "User Management" ? (
          <>
            <div className="more-form-strip">
              <label>{t("Username")}<input disabled /></label>
              <label>{t("Role Name")}<select aria-label={t("Role Name")} disabled><option>{t("All")}</option></select></label>
              <label>{t("Email")}<input disabled type="email" /></label>
              <button type="button" className="primary more-push-end" disabled>{t("Add User")}</button>
            </div>
            <EmptyTable columns={["Username", "Role Name", "Company Name", "Company Type", "Email", "Operation"]}
              message="Company user data is unavailable." />
          </>
        ) : <div className="more-unavailable" role="status"><Icon name="info" size={24} /><p>{t("Company data for this section is unavailable.")}</p></div>}
      </section>
    </div>
  );
}

function DiagnosisWorkspace({ section, onOpenPlantSection }: {
  section: "iv-diagnosis" | "module-diagnosis"; onOpenPlantSection: Props["onOpenPlantSection"];
}) {
  const panels = ["Diagnosis Task Management", "Export Management", "Self-Learning Configuration"];
  const [panel, setPanel] = useState(panels[0]);
  const [scheduled, setScheduled] = useState(false);
  const label = MORE_ITEMS[section].label;
  return (
    <div className="more-split">
      <aside className="more-workspace-side">
        <h1><Icon name="chart" size={19} />{t(label)}</h1>
        <nav className="more-side-links" aria-label={t(label)}>
          <button type="button" aria-current={panel === panels[0] ? "page" : undefined} onClick={() => setPanel(panels[0])}>{t(panels[0])}</button>
          <button type="button" onClick={() => onOpenPlantSection("configure-strings")}>{t("Configure Strings")}</button>
          <button type="button" onClick={() => onOpenPlantSection("module-library-management")}>{t("Module Library Management")}</button>
          {panels.slice(1).map((item) => <button key={item} type="button" aria-current={panel === item ? "page" : undefined}
            onClick={() => setPanel(item)}>{t(item)}</button>)}
        </nav>
      </aside>
      <section className="more-card" aria-labelledby="more-diagnosis-title">
        <header className="more-card-heading more-diagnosis-heading">
          <h2 id="more-diagnosis-title">{t(panel)}</h2>
          {panel === panels[0] && <div className="more-task-filters" role="group" aria-label={t("Diagnosis task status")}>
            <label><input type="radio" name="diagnosis-status" checked={!scheduled} onChange={() => setScheduled(false)} />{t("Completed")}</label>
            <label><input type="radio" name="diagnosis-status" checked={scheduled} onChange={() => setScheduled(true)} />{t("Scheduled")}</label>
          </div>}
          {section === "module-diagnosis" && <span className="more-beta">Beta</span>}
        </header>
        {panel === panels[0] ? (
          <>
            <div className="more-form-strip">
              <label>{t("Task Name")}<input disabled /></label>
              <label>{t("Plant name")}<input disabled /></label>
              <label>{t("Device name")}<input disabled /></label>
              <label>{t("Start Time")}<input type="date" disabled /></label>
              <button type="button" className="primary" disabled>{t("Search")}</button>
              <button type="button" className="outline" disabled>{t("Reset")}</button>
            </div>
            <div className="more-action-bar">
              <button type="button" className="primary" disabled>{t("Add Diagnosis Task")}</button>
              <button type="button" className="outline" disabled>{t("Delete")}</button>
              <button type="button" className="outline" disabled>{t("Rerun Diagnosis")}</button>
            </div>
            <EmptyTable columns={["Task Name", "Plant Name", scheduled ? "Scheduled Time" : "Start Time", "Duration", "Operation"]}
              message="Diagnosis tasks are unavailable." />
          </>
        ) : <div className="more-unavailable" role="status"><Icon name="info" size={24} /><p>{t("This feature is awaiting backend integration.")}</p></div>}
      </section>
    </div>
  );
}

function PersonalSettings({ displayName }: { displayName: string }) {
  const { language, setLanguage } = useLanguage();
  return (
    <section className="more-card more-settings">
      <h1>{t("Personal Settings")}</h1>
      <p><strong>{t("Username")}</strong><span>{displayName}</span></p>
      <div role="group" aria-label={t("Language")}>
        <strong>{t("Language")}</strong>
        {LANGUAGES.map((item) => <button type="button" className={language === item.code ? "primary" : "outline"} aria-pressed={language === item.code}
          key={item.code} lang={item.code} onClick={() => setLanguage(item.code)}>{item.name}</button>)}
      </div>
    </section>
  );
}

export default function MoreWorkspace({
  section, onSectionChange, plants, loading, selected, onPlantChange, onPlantSelect, onOpenPlantSection,
  now, refreshKey, alarms, summary, displayName,
}: Props) {
  const category = categoryForMoreSection(section);
  const isMaintenance = category.id === "maintenance";
  const plant = plants.find((item) => item.plant_code === selected) ?? plants[0];
  const title = MORE_ITEMS[section].label;

  return (
    <div className="more-workspace">
      {isMaintenance && (
        <nav className="more-workspace-tabs more-maintenance-tabs" aria-label={t(category.label)}>
          {category.groups[0].items.map((item) => <button type="button" key={item} aria-current={section === item ? "page" : undefined}
            onClick={() => onSectionChange(item)}>{t(MORE_ITEMS[item].label)}</button>)}
        </nav>
      )}
      {section === "status" && <MoreRealTimeStatus plants={plants} now={now} refreshKey={refreshKey} loading={loading}
        alarms={alarms} summary={summary} onPlantSelect={onPlantSelect}
        onAlarmSelect={(code) => { onPlantChange(code); onSectionChange("alarms"); }} />}
      {section === "alarms" && (
        <section className="more-card more-alarms-page" aria-labelledby="more-alarm-heading">
          <header className="more-card-heading">
            <h1 id="more-alarm-heading">{t(title)}</h1>
            <label>{t("Plant")}<select aria-label={t("Plant")} value={plant?.plant_code ?? ""} disabled={!plants.length}
              onChange={(event) => onPlantChange(event.target.value)}>
              {!plants.length && <option value="">{t(loading ? "Loading plants…" : "No plants yet")}</option>}
              {plants.map((item) => <option key={item.plant_code} value={item.plant_code}>{item.plant_name}</option>)}
            </select></label>
          </header>
          <AlarmManagement key={plant?.plant_code} plant={plant} refreshKey={refreshKey} onOverview={() => plant && onPlantSelect(plant)} />
        </section>
      )}
      {section === "tasks" && <section className="more-card"><header className="more-card-heading"><h1>{t(title)}</h1></header>
        <EmptyTable columns={["Task Name", "Plant Name", "Status", "Operation"]} message="Maintenance tasks are unavailable." />
      </section>}
      {section === "company" && <CompanyManagement />}
      {(section === "iv-diagnosis" || section === "module-diagnosis") && (
        <DiagnosisWorkspace key={section} section={section} onOpenPlantSection={onOpenPlantSection} />
      )}
      {section === "personal" && <PersonalSettings displayName={displayName} />}
      {!isMaintenance && section !== "company" && section !== "iv-diagnosis" && section !== "module-diagnosis" && section !== "personal" && (
        <section className="more-card"><header className="more-card-heading"><h1>{t(title)}</h1></header>
          <div className="more-unavailable" role="status"><Icon name="info" size={26} /><p>{t("This section is unavailable in the current workspace.")}</p></div>
        </section>
      )}
    </div>
  );
}
