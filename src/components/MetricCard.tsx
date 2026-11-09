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
  return (
    <div className="metric-card">
      <div className="metric-icon">
        {icon}
      </div>

      <div>
        <div className="metric-title">
          {title}
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