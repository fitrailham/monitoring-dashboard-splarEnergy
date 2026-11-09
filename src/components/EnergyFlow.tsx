interface EnergyFlowProps {
  pvPower: number | null;
  batteryPower: number | null;
  batterySoc: number | null;
  loadPower: number | null;
  gridPower: number | null;
}

function formatValue(
  value: number | null,
  unit = "kW"
) {
  if (value === null) {
    return `-- ${unit}`;
  }

  return `${value.toFixed(2)} ${unit}`;
}

function EnergyFlow({
  pvPower,
  batteryPower,
  batterySoc,
  loadPower,
  gridPower,
}: EnergyFlowProps) {
  return (
    <div className="energy-flow">

      <div className="energy-node building-node">
        <div className="node-icon">
          🏢
        </div>

        <span>Building</span>

        <strong>
          {formatValue(loadPower)}
        </strong>
      </div>


      <div className="energy-line vertical-line" />


      <div className="energy-center">
        ⚡
      </div>


      <div className="energy-line left-line" />

      <div className="energy-node battery-node">
        <div className="node-icon">
          🔋
        </div>

        <span>ESS</span>

        <strong>
          {formatValue(batteryPower)}
        </strong>

        <small>
          SOC{" "}
          {batterySoc !== null
            ? `${batterySoc.toFixed(1)}%`
            : "--"}
        </small>
      </div>


      <div className="energy-line right-line" />

      <div className="energy-node grid-node">
        <div className="node-icon">
          ⚡
        </div>

        <span>Grid</span>

        <strong>
          {formatValue(gridPower)}
        </strong>
      </div>


      <div className="energy-line bottom-line" />

      <div className="energy-node pv-node">
        <div className="node-icon">
          ☀️
        </div>

        <span>Solar PV</span>

        <strong>
          {formatValue(pvPower)}
        </strong>
      </div>

    </div>
  );
}

export default EnergyFlow;