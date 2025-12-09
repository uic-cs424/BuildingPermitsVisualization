const DATA_URL = "embeddings_2d_pca_sample.csv";

const SCATTER_WIDTH = 700;
const SCATTER_HEIGHT = 520;
const BAR_WIDTH = 700;
const BAR_HEIGHT = 260;

function yearFilterExpr(year) {
  if (!year || year === "all") return "true";
  return `year(datum.ISSUE_DATE) == ${year}`;
}

function renderAll() {
  const yearVal = document.getElementById("yearSelector").value;

  // Clear previous chart to prevent duplicate signals
  document.getElementById("vis").innerHTML = "";

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    data: { url: DATA_URL },

    vconcat: [
      // === ROW 1: Scatter + Bar ===
      {
        hconcat: [
          // Scatterplot with brush
          {
            width: SCATTER_WIDTH,
            height: SCATTER_HEIGHT,
            transform: [{ filter: yearFilterExpr(yearVal) }],
            params: [
              {
                name: "brushSel",
                select: { type: "interval", encodings: ["x", "y"] }
              }
            ],
            mark: { type: "point", size: 40, filled: true },
            encoding: {
              x: { field: "x", type: "quantitative", axis: { title: "Embedding X (PCA)" } },
              y: { field: "y", type: "quantitative", axis: { title: "Embedding Y (PCA)" } },
              color: { field: "PERMIT_TYPE", type: "nominal" },
              opacity: {
                condition: { param: "brushSel", value: 1 },
                value: 0.15
              },
              tooltip: [
                { field: "RECORD_ID", title: "Permit ID" },
                { field: "PERMIT_TYPE", title: "Permit Type" },
                { field: "WORK_TYPE", title: "Work Type" },
                { field: "COMMUNITY_AREA_NAME", title: "Community" },
                { field: "REPORTED_COST", title: "Cost", type: "quantitative", format: ",.0f" },
                { field: "ISSUE_DATE", title: "Issue Date", type: "temporal" }
              ]
            },
            title: "Embedding Space — Brush to Filter"
          },

          // Bar Chart
          {
            width: BAR_WIDTH,
            height: SCATTER_HEIGHT,
            transform: [
              { filter: yearFilterExpr(yearVal) },
              { filter: { param: "brushSel" } }
            ],
            params: [
              {
                name: "typeSel",
                select: {
                  type: "point",
                  fields: ["PERMIT_TYPE"]
                }
              }
            ],
            mark: "bar",
            encoding: {
              x: {
                field: "PERMIT_TYPE",
                type: "nominal",
                sort: "-y",
                axis: { title: "Permit Type", labelLimit: 100 }
              },
              y: {
                aggregate: "count",
                type: "quantitative",
                title: "Count"
              },
              color: {
                field: "PERMIT_TYPE",
                type: "nominal",
                legend: null,
                condition: {
                  param: "typeSel",
                  value: "#e67e22"
                }
              },
              tooltip: [
                { field: "PERMIT_TYPE", title: "Permit Type" },
                { aggregate: "count", title: "Permit Count" }
              ]
            },
            title: "Permit Types (Click to Filter)"
          }
        ]
      },

      // === ROW 2: Map (full width) ===
      {
        width: SCATTER_WIDTH + BAR_WIDTH + 20,
        height: 400,
        data: {
          url: "ChicagoNeighborhoods.geojson",
          format: { type: "json", property: "features" }
        },
        transform: [
          {
            lookup: "properties.community",
            from: {
              data: { url: DATA_URL },
              key: "COMMUNITY_UPPER",
              fields: ["ISSUE_DATE", "PERMIT_TYPE", "x", "y", "REPORTED_COST"]
            }
          },
          { filter: yearFilterExpr(yearVal) },
          { filter: { param: "brushSel" } },
          { filter: { param: "typeSel" } },
          { filter: { param: "costSel" } },
          { filter: { param: "timeSel" } },
          {
            joinaggregate: [{ op: "count", as: "PermitCount" }],
            groupby: ["properties.community"]
          }
        ],
        mark: { 
          type: "geoshape", 
          stroke: "white", 
          strokeWidth: 1
        },
        encoding: {
          color: {
            field: "PermitCount",
            type: "quantitative",
            title: "Permits",
            scale: { scheme: "blues" }
          },
          tooltip: [
            { field: "properties.community", title: "Community" },
            { field: "PermitCount", title: "Permits", format: ",.0f" }
          ]
        },
        projection: { type: "mercator" },
        title: "Permit Distribution by Community Area"
      },

      // === ROW 3: Cost + Time ===
      {
        hconcat: [
          // Cost Histogram
          {
            width: SCATTER_WIDTH,
            height: BAR_HEIGHT,
            transform: [
              { filter: yearFilterExpr(yearVal) },
              { filter: { param: "brushSel" } },
              { filter: { param: "typeSel" } },
              { calculate: "toNumber(datum.REPORTED_COST)", as: "COST" },
              {
                filter: "isValid(datum.COST) && datum.COST > 0 && datum.COST <= 5000000"
              }
            ],
            params: [
              {
                name: "costSel",
                select: { type: "interval", encodings: ["x"] }
              }
            ],
            mark: "bar",
            encoding: {
              x: {
                field: "COST",
                type: "quantitative",
                bin: { maxbins: 40 },
                title: "Reported Cost ($)"
              },
              y: { aggregate: "count", type: "quantitative", title: "Permits" },
              color: { 
                value: "#16a085",
                condition: {
                  param: "costSel",
                  value: "#e67e22"
                }
              },
              tooltip: [
                { aggregate: "count", title: "Permits" },
                {
                  aggregate: "mean",
                  field: "COST",
                  title: "Avg Cost",
                  format: ",.0f"
                }
              ]
            },
            title: "Cost Distribution (Brush to Filter)"
          },
 
          // Time Series
          {
            width: BAR_WIDTH,
            height: BAR_HEIGHT,
            transform: [
              { filter: yearFilterExpr(yearVal) },
              { filter: { param: "brushSel" } },
              { filter: { param: "typeSel" } },
              { filter: { param: "costSel" } },
              { timeUnit: "yearmonth", field: "ISSUE_DATE", as: "YM" },
              { aggregate: [{ op: "count", as: "Permits" }], groupby: ["YM"] }
            ],
            params: [
              {
                name: "timeSel",
                select: { type: "interval", encodings: ["x"] }
              }
            ],
            mark: { type: "line", point: true, color: "#2c7fb8" },
            encoding: {
              x: {
                field: "YM",
                type: "temporal",
                axis: { title: "Month", format: "%b %Y" }
              },
              y: {
                field: "Permits",
                type: "quantitative",
                title: "Permit Count"
              },
              strokeWidth: {
                condition: {
                  param: "timeSel",
                  value: 4
                },
                value: 2
              },
              tooltip: [
                { field: "YM", type: "temporal", title: "Month", format: "%b %Y" },
                { field: "Permits", type: "quantitative", title: "Permits Issued" }
              ]
            },
            title: "Permits Over Time (Brush to Filter)"
          }
        ]
      }
    ]
  };

  vegaEmbed("#vis", spec, { actions: false });
}

renderAll();
document.getElementById("yearSelector").addEventListener("change", renderAll);