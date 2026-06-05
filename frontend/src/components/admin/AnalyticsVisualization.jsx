import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_COLORS = ['#2563eb', '#f97316', '#059669', '#7c3aed', '#dc2626', '#0f766e', '#ca8a04', '#9333ea'];

function isValidSpec(spec) {
  if (!spec || typeof spec !== 'object') return false;
  if (!['line', 'bar', 'pie'].includes(spec.kind)) return false;
  if (!spec.x_key || !Array.isArray(spec.dataset) || spec.dataset.length === 0) return false;
  if (!Array.isArray(spec.series) || spec.series.length === 0) return false;
  if (spec.kind === 'pie') return spec.series.length === 1;
  return spec.series.length <= 2;
}

function renderLineOrBar(spec) {
  const Chart = spec.kind === 'line' ? LineChart : BarChart;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <Chart data={spec.dataset} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis dataKey={spec.x_key} tick={{ fill: '#475569', fontSize: 12 }} />
        <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {spec.kind === 'line'
          ? spec.series.map((series, index) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))
          : spec.series.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                radius={[6, 6, 0, 0]}
              />
            ))}
      </Chart>
    </ResponsiveContainer>
  );
}

function renderPie(spec) {
  const series = spec.series[0];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Tooltip />
        <Legend />
        <Pie
          data={spec.dataset}
          dataKey={series.key}
          nameKey={spec.x_key}
          name={series.label}
          outerRadius={96}
          innerRadius={42}
          paddingAngle={2}
        >
          {spec.dataset.map((entry, index) => (
            <Cell key={`${entry[spec.x_key]}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function AnalyticsVisualization({ spec }) {
  if (!isValidSpec(spec)) return null;

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{spec.title || 'Visualization'}</h3>
          {spec.description ? <p className="mt-1 text-xs text-slate-600">{spec.description}</p> : null}
        </div>
        <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {spec.kind}
        </div>
      </div>

      <div className="h-[280px] w-full">
        {spec.kind === 'pie' ? renderPie(spec) : renderLineOrBar(spec)}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        {spec.x_label ? <span>X: {spec.x_label}</span> : null}
        {spec.y_label ? <span>Y: {spec.y_label}</span> : null}
        {spec.truncated ? <span>Showing a truncated preview.</span> : null}
      </div>
    </section>
  );
}
