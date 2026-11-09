function EnergyChart() {
  return (
    <div className="panel chart-panel">

      <div className="chart-header">
        <h3>Energy Overview</h3>

        <div className="chart-tabs">
          <button className="active">
            Day
          </button>

          <button>
            Month
          </button>

          <button>
            Year
          </button>

          <button>
            Lifetime
          </button>
        </div>
      </div>

      <div className="fake-chart">

        <div className="chart-grid-line line-1" />
        <div className="chart-grid-line line-2" />
        <div className="chart-grid-line line-3" />

        <svg
          viewBox="0 0 1000 250"
          preserveAspectRatio="none"
        >
          <polyline
            className="solar-line"
            points="
              0,230
              100,230
              200,225
              300,200
              400,140
              500,70
              600,40
              700,50
              800,80
              900,150
              1000,220
            "
          />

          <polyline
            className="battery-line"
            points="
              0,230
              250,230
              350,220
              420,170
              460,230
              500,120
              540,230
              600,190
              650,230
              1000,230
            "
          />
        </svg>

      </div>

    </div>
  );
}

export default EnergyChart;