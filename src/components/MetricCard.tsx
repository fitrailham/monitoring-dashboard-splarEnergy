import { translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: string;
}

function MetricCard({
  title,
  value,
  unit,
  icon = "⚡",
}: MetricCardProps) {
  useLanguage();
  return (
    <div className="metric-card">
      <div className="metric-icon">
        {icon}
      </div>

      <div>
        <div className="metric-title">
          {t(title)}
        </div>

        <div className="metric-value">
          {value}

          {unit && (
            <span className="metric-unit">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default MetricCard;