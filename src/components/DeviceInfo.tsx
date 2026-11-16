import { translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
interface DeviceInfoProps {
  pvCapacity: number | null;
  essCapacity?: number;
}

function DeviceInfo({
  pvCapacity,
  essCapacity = 860.16,
}: DeviceInfoProps) {
  useLanguage();
  return (
    <div className="panel device-panel">
      <h3>{t("Device Information")}</h3>

      <div className="device-grid">
        <div className="device-item">
          <div className="device-icon">
            ☀️
          </div>

          <div className="device-label">{t("Installed PV Capacity")}</div>

          <div className="device-value">
            {pvCapacity?.toFixed(2) ?? "--"}
            <span>{t(" kWp")}</span>
          </div>
        </div>

        <div className="device-item">
          <div className="device-icon">
            🔋
          </div>

          <div className="device-label">{t("Installed ESS Capacity")}</div>

          <div className="device-value">
            {essCapacity.toFixed(2)}
            <span>{t(" kWh")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeviceInfo;