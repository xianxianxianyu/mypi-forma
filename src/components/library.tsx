import { useId, useState } from 'react';
import { createLibrary, defineComponent } from '@openuidev/react-lang';
import { ArrowUpRight, Check, ChevronRight, SlidersHorizontal, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { chartSchema, metricSchema, planSchema, preferencesSchema } from '../lib/schemas';
import { MotionRegion } from '../lib/motion';

function PreferenceView({ props }: { props: z.infer<typeof preferencesSchema> }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  return <article className="widget preference-card" data-widget-id={props.id}>
    <div className="widget-eyebrow"><SlidersHorizontal size={16} /> YOUR WORKSPACE</div>
    <h3>{props.title}</h3><p className="muted">{props.description}</p>
    <div className="preference-list">{props.options.map((option) => <label className="preference-row" key={option}>
      <span>{option}</span><input type="checkbox" role="switch" checked={checked[option] ?? true}
        onChange={(event) => setChecked((state) => ({ ...state, [option]: event.target.checked }))} />
    </label>)}</div>
    <div className="widget-footer"><span className="status-dot" /> Changes saved locally in this preview</div>
  </article>;
}

function PlanView({ props }: { props: z.infer<typeof planSchema> }) {
  const [selected, setSelected] = useState(false);
  return <article className="widget plan-card" data-widget-id={props.id}>
    <div className="plan-heading"><span className="widget-eyebrow">MADE FOR YOUR NEXT CHAPTER</span><Sparkles size={18} /></div>
    <h3>{props.title}</h3><p className="muted">{props.description}</p>
    <div className="plan-price">{props.price}</div>
    <ul>{props.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
    <button className="plan-cta" onClick={() => setSelected(!selected)} aria-pressed={selected}>
      {selected ? '已选择 · 仅演示，不会扣费' : props.buttonLabel}<ChevronRight size={16} />
    </button>
  </article>;
}

function ChartView({ props }: { props: z.infer<typeof chartSchema> }) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const gradientId = useId().replaceAll(':', '');
  const values = props.values.map((value, i) => period === 'week' ? value : Math.round(value * (1.15 + i * .025)));
  const max = Math.max(...values, 1) * 1.18;
  const points = values.map((value, i) => `${20 + i * 460 / (values.length - 1)},${150 - value / max * 125}`);
  const line = `M${points.join(' L')}`;
  return <article className="widget chart-card" data-widget-id={props.id}>
    <div className="chart-heading"><div><div className="widget-eyebrow">PERFORMANCE OVERVIEW</div>
      <h3>{props.title}</h3><p className="muted">{props.subtitle}</p></div>
      <div className="segmented" aria-label="图表时间范围"><button aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>周</button>
        <button aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>月</button></div>
    </div>
    <div className="chart-summary"><strong>{values.reduce((sum, value) => sum + value, 0).toLocaleString()}</strong><span>累计 · {period === 'week' ? '本周' : '本月（演示换算）'}</span></div>
    <svg className="activity-plot" viewBox="0 0 500 180" role="img" aria-label={`${props.title}：${values.join('、')}`}>
      <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a9c68f" stopOpacity=".4" /><stop offset="100%" stopColor="#a9c68f" stopOpacity="0" /></linearGradient></defs>
      {[35, 80, 125].map((y) => <path key={y} d={`M20 ${y}H480`} stroke="currentColor" opacity=".09" strokeDasharray="3 5" />)}
      <path d={`${line} L480 160 L20 160 Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="#497852" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((value, i) => <circle key={i} cx={20 + i * 460 / (values.length - 1)} cy={150 - value / max * 125} r="4" fill="#fff" stroke="#497852" strokeWidth="2"><title>{props.labels[i]}: {value}</title></circle>)}
    </svg>
    <div className="chart-labels">{props.labels.map((label, i) => <span key={i}>{label}</span>)}</div>
  </article>;
}

const MetricCard = defineComponent({
  name: 'MetricCard', description: 'A polished KPI card. Keep id stable across edits. change is factual text, not necessarily positive. tone is lime, lavender, or peach.',
  props: metricSchema,
  component: ({ props }) => <MotionRegion signature={JSON.stringify(props)}><article className={`widget metric-card tone-${props.tone}`} data-widget-id={props.id}>
    <div className="metric-top"><span>{props.label}</span><ArrowUpRight size={19} /></div>
    <div className="metric-value">{props.value}</div>
    <div className="metric-bottom"><span className="change-pill">{props.change}</span><span>{props.caption}</span></div>
  </article></MotionRegion>,
});
const ActivityChart = defineComponent({ name: 'ActivityChart', description: 'A line chart with 3–12 nonnegative values and exactly as many labels. Week/month controls use local demo state.', props: chartSchema,
  component: ({ props }) => <MotionRegion signature={JSON.stringify(props)}><ChartView props={props} /></MotionRegion> });
const PlanCard = defineComponent({ name: 'PlanCard', description: 'A pricing plan with 1–5 benefits and a local-only selection button. No payment occurs.', props: planSchema,
  component: ({ props }) => <MotionRegion signature={JSON.stringify(props)}><PlanView props={props} /></MotionRegion> });
const PreferenceCard = defineComponent({ name: 'PreferenceCard', description: 'A settings panel with 1–4 accessible interactive switches. State is local to this preview.', props: preferencesSchema,
  component: ({ props }) => <MotionRegion signature={JSON.stringify(props)}><PreferenceView props={props} /></MotionRegion> });
const Showcase = defineComponent({
  name: 'Showcase', description: 'The root canvas. Compose 1–6 widgets with stable statement names and stable unique ids.',
  props: z.object({ title: z.string().min(1).max(100), subtitle: z.string().max(180), children: z.array(z.union([MetricCard.ref, ActivityChart.ref, PlanCard.ref, PreferenceCard.ref])).min(1).max(6) }),
  component: ({ props, renderNode }) => <section className="showcase"><header className="showcase-heading"><span className="eyebrow">YOUR NEXT GREAT INTERFACE</span><h2>{props.title}</h2><p>{props.subtitle}</p></header><div className="widget-grid">{renderNode(props.children)}</div></section>,
});
export const library = createLibrary({ root: 'Showcase', components: [Showcase, MetricCard, ActivityChart, PlanCard, PreferenceCard] });
