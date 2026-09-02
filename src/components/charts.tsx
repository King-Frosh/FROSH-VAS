"use client";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar, Chart, Doughnut } from "react-chartjs-2";
import { compactMoney as formatCompactMoney, money, num } from "@/lib/format";

/*
 * Chart.js v4 is tree-shakable: every chart TYPE needs its controller
 * registered, not just the visual elements. The mixed revenue-trend chart
 * renders line datasets inside a bar chart, so BarController, LineController
 * and DoughnutController must all be present.
 */
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  BarController,
  LineController,
  DoughnutController,
  Tooltip,
  Legend,
  Filler,
);
ChartJS.defaults.font.family = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace";
ChartJS.defaults.font.size = 10;
ChartJS.defaults.color = "#5C6B7E";

export const PALETTE = [
  "#0C8F63",
  "#0E7490",
  "#D97706",
  "#64748B",
  "#B91C1C",
  "#0F766E",
  "#A16207",
  "#475569",
];

const GRID = "rgba(11,21,36,0.06)";

export function TrendChart({
  labels,
  gross,
  net,
  txns,
  height = 280,
}: {
  labels: string[];
  gross: number[];
  net: number[];
  txns: number[];
  height?: number;
}) {
  const data = {
    labels,
    datasets: [
      {
        type: "line" as const,
        label: "Gross revenue",
        data: gross,
        borderColor: "#0C8F63",
        backgroundColor: "rgba(12,143,99,0.10)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: "#0C8F63",
        borderWidth: 2,
        yAxisID: "y",
        order: 1,
      },
      {
        type: "line" as const,
        label: "Net revenue",
        data: net,
        borderColor: "#0E7490",
        backgroundColor: "transparent",
        borderDash: [5, 4],
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: "#0E7490",
        borderWidth: 2,
        yAxisID: "y",
        order: 2,
      },
      {
        type: "bar" as const,
        label: "Transactions",
        data: txns,
        backgroundColor: "rgba(11,21,36,0.10)",
        hoverBackgroundColor: "rgba(11,21,36,0.22)",
        borderRadius: 3,
        barPercentage: 0.7,
        categoryPercentage: 0.85,
        yAxisID: "y1",
        order: 3,
      },
    ],
  } as unknown as ChartData<"bar" | "line", number[], string>;

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    scales: {
      y: {
        grid: { color: GRID },
        border: { display: false },
        ticks: { callback: (v) => formatCompactMoney(Number(v)) },
      },
      y1: {
        position: "right",
        grid: { display: false },
        border: { display: false },
        ticks: { precision: 0 },
      },
      x: { grid: { display: false }, border: { color: GRID } },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0B1524",
        padding: 10,
        titleFont: { family: "'IBM Plex Sans', sans-serif", size: 11 },
        bodyFont: { size: 11 },
        callbacks: {
          label: (c) =>
            c.dataset.type === "bar"
              ? ` ${c.dataset.label}: ${num(Number(c.parsed.y))}`
              : ` ${c.dataset.label}: ${money(Number(c.parsed.y))}`,
        },
      },
    },
  };
  return (
    <div style={{ height }}>
      <Chart type="bar" data={data} options={options} />
    </div>
  );
}

export function HBarChart({
  labels,
  values,
  height = 280,
  moneyAxis = true,
}: {
  labels: string[];
  values: number[];
  height?: number;
  moneyAxis?: boolean;
}) {
  const data: ChartData<"bar", number[], string> = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderRadius: 4,
        barPercentage: 0.75,
      },
    ],
  };
  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: GRID },
        border: { display: false },
        ticks: { callback: (v) => (moneyAxis ? formatCompactMoney(Number(v)) : num(Number(v))) },
      },
      y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0B1524",
        padding: 10,
        callbacks: {
          label: (c) => ` ${moneyAxis ? money(Number(c.parsed.x)) : num(Number(c.parsed.x))}`,
        },
      },
    },
  };
  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
}

export function DoughnutChart({
  labels,
  values,
  height = 240,
  centerLabel,
}: {
  labels: string[];
  values: number[];
  height?: number;
  centerLabel?: string;
}) {
  const data: ChartData<"doughnut", number[], string> = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };
  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "64%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, padding: 12, font: { family: "'IBM Plex Sans', sans-serif", size: 11 } },
      },
      tooltip: {
        backgroundColor: "#0B1524",
        padding: 10,
        callbacks: { label: (c) => ` ${c.label}: ${money(Number(c.parsed))}` },
      },
    },
  };
  return (
    <div className="relative" style={{ height }}>
      <Doughnut data={data} options={options} />
      {centerLabel && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] -translate-y-1/2 text-center">
          <p className="num text-lg font-semibold text-ink-900">{centerLabel}</p>
        </div>
      )}
    </div>
  );
}
