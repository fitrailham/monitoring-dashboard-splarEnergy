interface DeviceInfoProps {
  pvCapacity: number | null;
  essCapacity?: number;
}

function DeviceInfo({
  pvCapacity,
  essCapacity = 860.16,
}: DeviceInfoProps) {
  return (
    <div className="panel device-panel">
      <h3>Device Information</h3>

      <div className="device-grid">
        <div className="device-item">
          <div className="device-icon">
            ☀️
          </div>

          <div className="device-label">
            Installed PV Capacity
          </div>

          <div className="device-value">
            {pvCapacity?.toFixed(2) ?? "--"}
            <span> kWp</span>
          </div>
        </div>

        <div className="device-item">
          <div className="device-icon">
            🔋
          </div>

          <div className="device-label">
            Installed ESS Capacity
          </div>

          <div className="device-value">
            {essCapacity.toFixed(2)}
            <span> kWh</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeviceInfo;