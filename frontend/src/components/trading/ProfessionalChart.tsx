"use client";

import { useEffect, useState, useRef } from "react";
import { formatPercent } from "@/lib/utils";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartIndicators {
  ma20?: number[];
  ma50?: number[];
  ma200?: number[];
  rsi?: number[];
  macd?: { macd: number; signal: number; histogram: number }[];
  bollinger?: { upper: number[]; middle: number[]; lower: number[] };
  volume?: number[];
}

interface ProfessionalChartProps {
  pair: { base: string; quote: string };
  timeframe: string;
  chartType: "candlestick" | "line" | "area";
  indicators: {
    ma20: boolean;
    ma50: boolean;
    ma200: boolean;
    rsi: boolean;
    macd: boolean;
    bollinger: boolean;
    volume: boolean;
  };
}

interface CrosshairData {
  x: number;
  y: number;
  price: number;
  time: string;
  candle?: Candle;
  ohlc?: { o: number; h: number; l: number; c: number };
}

const COLORS = {
  bg: "#0a0e27",
  grid: "rgba(90, 106, 138, 0.1)",
  text: "#d0d8e6",
  up: "#00e676",
  down: "#ff5252",
  ma20: "#ffa726",
  ma50: "#42a5f5",
  ma200: "#ab47bc",
  accent: "#00bcd4",
};

export default function ProfessionalChart({
  pair,
  timeframe,
  chartType,
  indicators,
}: ProfessionalChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicatorData, setIndicatorData] = useState<ChartIndicators>({});
  const [crosshair, setCrosshair] = useState<CrosshairData | null>(null);
  const [stats, setStats] = useState({
    high: 0,
    low: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
  });

  // Generate candles
  useEffect(() => {
    const basePrice = 66499;
    const newCandles: Candle[] = [];

    for (let i = 0; i < 200; i++) {
      const open = basePrice + (Math.random() - 0.5) * 1000;
      const close = open + (Math.random() - 0.5) * 800;
      newCandles.push({
        time: Date.now() - (200 - i) * 3600000,
        open,
        high: Math.max(open, close) + Math.random() * 500,
        low: Math.min(open, close) - Math.random() * 500,
        close,
        volume: Math.random() * 10000000 + 1000000,
      });
    }
    setCandles(newCandles);

    // Calculate stats
    const closes = newCandles.map((c) => c.close);
    const high = Math.max(...newCandles.map((c) => c.high));
    const low = Math.min(...newCandles.map((c) => c.low));
    const change = closes[closes.length - 1] - closes[0];
    const changePercent = ((change / closes[0]) * 100);
    const volume = newCandles.reduce((sum, c) => sum + c.volume, 0);

    setStats({ high, low, change, changePercent, volume });
  }, [timeframe]);

  // Calculate indicators
  useEffect(() => {
    if (candles.length === 0) return;

    const newIndicators: ChartIndicators = {};
    const closes = candles.map((c) => c.close);

    if (indicators.ma20) {
      newIndicators.ma20 = calculateMA(closes, 20);
    }
    if (indicators.ma50) {
      newIndicators.ma50 = calculateMA(closes, 50);
    }
    if (indicators.ma200) {
      newIndicators.ma200 = calculateMA(closes, 200);
    }
    if (indicators.rsi) {
      newIndicators.rsi = calculateRSI(closes, 14);
    }
    if (indicators.macd) {
      newIndicators.macd = calculateMACD(closes);
    }
    if (indicators.bollinger) {
      newIndicators.bollinger = calculateBollingerBands(closes, 20);
    }
    if (indicators.volume) {
      newIndicators.volume = candles.map((c) => c.volume);
    }

    setIndicatorData(newIndicators);
  }, [candles, indicators]);

  // Draw chart
  useEffect(() => {
    if (!canvasRef.current || candles.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const displayWidth = rect.width;
    const displayHeight = rect.height;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const chartHeight = displayHeight * 0.75;
    const volumeHeight = displayHeight * 0.25;
    const padding = 60;
    const chartWidth = displayWidth - padding * 2;

    // Dark gradient background
    const gradientBg = ctx.createLinearGradient(0, 0, 0, displayHeight);
    gradientBg.addColorStop(0, "#0a0e27");
    gradientBg.addColorStop(1, "#0f1429");
    ctx.fillStyle = gradientBg;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Draw grid
    drawGrid(ctx, displayWidth, displayHeight, chartHeight, padding, COLORS.grid);

    // Calculate price range
    const high = Math.max(...candles.map((c) => c.high));
    const low = Math.min(...candles.map((c) => c.low));
    const range = high - low || 1;

    // Draw volume bars
    if (indicators.volume) {
      drawVolume(ctx, candles, displayWidth, padding, chartHeight, chartWidth, volumeHeight);
    }

    // Draw price candles/lines
    if (chartType === "candlestick") {
      drawCandlesticks(ctx, candles, padding, chartHeight, chartWidth, range, low, displayWidth);
    } else if (chartType === "line") {
      drawLineChart(ctx, candles, padding, chartHeight, chartWidth, range, low, displayWidth);
    } else if (chartType === "area") {
      drawAreaChart(ctx, candles, padding, chartHeight, chartWidth, range, low, displayWidth);
    }

    // Draw indicators
    if (indicators.bollinger && indicatorData.bollinger) {
      drawBollingerBands(
        ctx,
        indicatorData.bollinger,
        padding,
        chartHeight,
        chartWidth,
        range,
        low,
        displayWidth
      );
    }

    if (indicators.ma20 && indicatorData.ma20) {
      drawMovingAverage(
        ctx,
        indicatorData.ma20,
        padding,
        chartHeight,
        chartWidth,
        range,
        low,
        displayWidth,
        COLORS.ma20,
        2
      );
    }

    if (indicators.ma50 && indicatorData.ma50) {
      drawMovingAverage(
        ctx,
        indicatorData.ma50,
        padding,
        chartHeight,
        chartWidth,
        range,
        low,
        displayWidth,
        COLORS.ma50,
        2
      );
    }

    if (indicators.ma200 && indicatorData.ma200) {
      drawMovingAverage(
        ctx,
        indicatorData.ma200,
        padding,
        chartHeight,
        chartWidth,
        range,
        low,
        displayWidth,
        COLORS.ma200,
        2
      );
    }

    // Draw price labels on right axis
    drawPriceLabels(ctx, high, low, padding, chartHeight, displayWidth, COLORS.text);

    // Draw time labels on bottom axis
    drawTimeLabels(ctx, candles, padding, chartHeight, displayWidth, COLORS.text);

    // Draw crosshair if hovering
    if (crosshair) {
      drawCrosshair(ctx, crosshair, displayWidth, displayHeight, padding, chartHeight);
    }
  }, [candles, indicators, indicatorData, crosshair, chartType]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = 60;
    const chartHeight = rect.height * 0.75;
    const chartWidth = rect.width - padding * 2;

    if (x < padding || x > rect.width - padding || y < padding || y > padding + chartHeight) {
      setCrosshair(null);
      return;
    }

    const high = Math.max(...candles.map((c) => c.high));
    const low = Math.min(...candles.map((c) => c.low));
    const range = high - low || 1;

    const candleIndex = Math.floor(
      ((x - padding) / chartWidth) * candles.length
    );
    const candle = candles[candleIndex];

    const price = high - ((y - padding) / chartHeight) * range;
    const time = new Date(candle.time).toLocaleTimeString();

    setCrosshair({
      x,
      y,
      price,
      time,
      candle,
      ohlc: {
        o: candle.open,
        h: candle.high,
        l: candle.low,
        c: candle.close,
      },
    });
  };

  const handleMouseLeave = () => {
    setCrosshair(null);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-lg overflow-hidden border border-slate-800 shadow-2xl">
      {/* Header with stats */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <span className="text-2xl font-bold text-white">
              {formatUsd(candles[candles.length - 1]?.close || 0)}
            </span>
            <span
              className={`text-lg font-semibold ${
                stats.change >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {stats.change >= 0 ? "+" : ""}
              {formatUsd(stats.change)} ({formatPercent(stats.changePercent)})
            </span>
          </div>
          <div className="flex gap-8 text-sm">
            <div className="flex flex-col items-end">
              <span className="text-slate-400">24H High</span>
              <span className="text-emerald-400 font-semibold">{formatUsd(stats.high)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-slate-400">24H Low</span>
              <span className="text-red-400 font-semibold">{formatUsd(stats.low)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-slate-400">24H Volume</span>
              <span className="text-blue-400 font-semibold">
                {(stats.volume / 1e6).toFixed(2)}M
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart canvas */}
      <div ref={containerRef} className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Crosshair tooltip */}
        {crosshair && (
          <div
            className="absolute pointer-events-none bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl z-10"
            style={{
              left: `${crosshair.x + 10}px`,
              top: `${crosshair.y - 80}px`,
            }}
          >
            <div className="text-sm text-slate-300 space-y-1 whitespace-nowrap">
              <div className="font-semibold text-white">
                {formatUsd(crosshair.price)}
              </div>
              <div className="text-xs text-slate-400">{crosshair.time}</div>
              {crosshair.ohlc && (
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700">
                  <div className="text-slate-400">
                    <span className="text-slate-500">O:</span> {formatUsd(crosshair.ohlc.o)}
                  </div>
                  <div className="text-emerald-400">
                    <span className="text-slate-500">H:</span> {formatUsd(crosshair.ohlc.h)}
                  </div>
                  <div className="text-red-400">
                    <span className="text-slate-500">L:</span> {formatUsd(crosshair.ohlc.l)}
                  </div>
                  <div
                    className={
                      crosshair.ohlc.c >= crosshair.ohlc.o
                        ? "text-emerald-400"
                        : "text-red-400"
                    }
                  >
                    <span className="text-slate-500">C:</span> {formatUsd(crosshair.ohlc.c)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  chartHeight: number,
  padding: number,
  gridColor: string
) {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  // Horizontal lines
  for (let i = 0; i <= 10; i++) {
    const y = padding + (chartHeight / 10) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Vertical lines
  const chartWidth = width - padding * 2;
  for (let i = 0; i <= 10; i++) {
    const x = padding + (chartWidth / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, padding + chartHeight);
    ctx.stroke();
  }
}

function drawCandlesticks(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  padding: number,
  chartHeight: number,
  chartWidth: number,
  range: number,
  low: number,
  displayWidth: number
) {
  const wickWidth = 0.2;
  const bodyWidth = Math.max(chartWidth / candles.length * 0.6, 1);

  candles.forEach((candle, i) => {
    const x = padding + (i / candles.length) * chartWidth + chartWidth / (candles.length * 2);
    const isUp = candle.close >= candle.open;

    // Wick
    const highY = padding + chartHeight - ((candle.high - low) / range) * chartHeight;
    const lowY = padding + chartHeight - ((candle.low - low) / range) * chartHeight;

    ctx.strokeStyle = isUp ? COLORS.up : COLORS.down;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    // Body
    const openY = padding + chartHeight - ((candle.open - low) / range) * chartHeight;
    const closeY = padding + chartHeight - ((candle.close - low) / range) * chartHeight;

    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.abs(closeY - openY) || 2;

    ctx.fillStyle = isUp ? COLORS.up : COLORS.down;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    ctx.globalAlpha = 1;

    // Border
    ctx.strokeStyle = isUp ? COLORS.up : COLORS.down;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
  });
}

function drawLineChart(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  padding: number,
  chartHeight: number,
  chartWidth: number,
  range: number,
  low: number,
  displayWidth: number
) {
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  candles.forEach((candle, i) => {
    const x = padding + (i / candles.length) * chartWidth + chartWidth / (candles.length * 2);
    const y = padding + chartHeight - ((candle.close - low) / range) * chartHeight;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawAreaChart(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  padding: number,
  chartHeight: number,
  chartWidth: number,
  range: number,
  low: number,
  displayWidth: number
) {
  const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
  gradient.addColorStop(0, "rgba(0, 188, 212, 0.3)");
  gradient.addColorStop(1, "rgba(0, 188, 212, 0.01)");

  ctx.fillStyle = gradient;
  ctx.beginPath();

  candles.forEach((candle, i) => {
    const x = padding + (i / candles.length) * chartWidth + chartWidth / (candles.length * 2);
    const y = padding + chartHeight - ((candle.close - low) / range) * chartHeight;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.lineTo(padding + chartWidth, padding + chartHeight);
  ctx.lineTo(padding, padding + chartHeight);
  ctx.closePath();
  ctx.fill();

  // Line on top
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  candles.forEach((candle, i) => {
    const x = padding + (i / candles.length) * chartWidth + chartWidth / (candles.length * 2);
    const y = padding + chartHeight - ((candle.close - low) / range) * chartHeight;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawMovingAverage(
  ctx: CanvasRenderingContext2D,
  values: number[],
  padding: number,
  chartHeight: number,
  chartWidth: number,
  range: number,
  low: number,
  displayWidth: number,
  color: string,
  lineWidth: number
) {
  const high = low + range;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  values.forEach((value, i) => {
    if (value === undefined) return;
    const x = padding + (i / values.length) * chartWidth;
    const y = padding + chartHeight - ((value - low) / range) * chartHeight;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawBollingerBands(
  ctx: CanvasRenderingContext2D,
  bollinger: { upper: number[]; middle: number[]; lower: number[] },
  padding: number,
  chartHeight: number,
  chartWidth: number,
  range: number,
  low: number,
  displayWidth: number
) {
  const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
  gradient.addColorStop(0, "rgba(255, 193, 7, 0.1)");
  gradient.addColorStop(1, "rgba(255, 193, 7, 0.05)");

  ctx.fillStyle = gradient;
  ctx.beginPath();

  bollinger.upper.forEach((value, i) => {
    if (value === undefined) return;
    const x = padding + (i / bollinger.upper.length) * chartWidth;
    const y = padding + chartHeight - ((value - low) / range) * chartHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  for (let i = bollinger.lower.length - 1; i >= 0; i--) {
    const value = bollinger.lower[i];
    if (value === undefined) continue;
    const x = padding + (i / bollinger.lower.length) * chartWidth;
    const y = padding + chartHeight - ((value - low) / range) * chartHeight;
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();

  // Middle line
  ctx.strokeStyle = "rgba(100, 150, 255, 0.6)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  bollinger.middle.forEach((value, i) => {
    if (value === undefined) return;
    const x = padding + (i / bollinger.middle.length) * chartWidth;
    const y = padding + chartHeight - ((value - low) / range) * chartHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawVolume(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  displayWidth: number,
  padding: number,
  chartHeight: number,
  chartWidth: number,
  volumeHeight: number
) {
  const maxVolume = Math.max(...candles.map((c) => c.volume));
  const volumeScaleFactor = volumeHeight / maxVolume;

  candles.forEach((candle, i) => {
    const x = padding + (i / candles.length) * chartWidth + chartWidth / (candles.length * 2);
    const width = Math.max(chartWidth / candles.length * 0.6, 1);
    const isUp = candle.close >= candle.open;
    const barHeight = candle.volume * volumeScaleFactor;

    ctx.fillStyle = isUp ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 82, 82, 0.2)";
    ctx.fillRect(
      x - width / 2,
      padding + chartHeight + volumeHeight - barHeight,
      width,
      barHeight
    );
  });
}

function drawPriceLabels(
  ctx: CanvasRenderingContext2D,
  high: number,
  low: number,
  padding: number,
  chartHeight: number,
  displayWidth: number,
  textColor: string
) {
  ctx.fillStyle = textColor;
  ctx.font = "12px sans-serif";
  ctx.textAlign = "right";

  for (let i = 0; i <= 5; i++) {
    const price = high - ((high - low) / 5) * i;
    const y = padding + (chartHeight / 5) * i;

    ctx.fillText(formatUsd(price), padding - 10, y + 4);
  }
}

function drawTimeLabels(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  padding: number,
  chartHeight: number,
  displayWidth: number,
  textColor: string
) {
  ctx.fillStyle = textColor;
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";

  for (let i = 0; i < 5; i++) {
    const index = Math.floor((i / 4) * (candles.length - 1));
    const candle = candles[index];
    const date = new Date(candle.time);
    const label = `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;

    const x = padding + ((i / 4) * (displayWidth - padding * 2));
    ctx.fillText(label, x, chartHeight + padding + 20);
  }
}

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  crosshair: CrosshairData,
  displayWidth: number,
  displayHeight: number,
  padding: number,
  chartHeight: number
) {
  ctx.strokeStyle = "rgba(0, 188, 212, 0.3)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  // Vertical line
  ctx.beginPath();
  ctx.moveTo(crosshair.x, padding);
  ctx.lineTo(crosshair.x, padding + chartHeight);
  ctx.stroke();

  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(padding, crosshair.y);
  ctx.lineTo(displayWidth - padding, crosshair.y);
  ctx.stroke();

  ctx.setLineDash([]);

  // Circle at intersection
  ctx.fillStyle = "rgba(0, 188, 212, 0.5)";
  ctx.beginPath();
  ctx.arc(crosshair.x, crosshair.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

// Calculation functions

function calculateMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateRSI(prices: number[], period: number): number[] {
  const deltas = [];
  for (let i = 1; i < prices.length; i++) {
    deltas.push(prices[i] - prices[i - 1]);
  }

  const result: number[] = [NaN];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    if (deltas[i] > 0) avgGain += deltas[i];
    else avgLoss -= deltas[i];
  }

  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < deltas.length; i++) {
    const delta = deltas[i];
    if (delta > 0) {
      avgGain = (avgGain * (period - 1) + delta) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - delta) / period;
    }

    const rs = avgGain / (avgLoss || 0.001);
    const rsi = 100 - 100 / (1 + rs);
    result.push(rsi);
  }

  return result;
}

function calculateMACD(
  prices: number[]
): { macd: number; signal: number; histogram: number }[] {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);

  const macd = ema12.map((v, i) => (v || 0) - (ema26[i] || 0));
  const signal = calculateEMA(macd, 9);

  return macd.map((m, i) => ({
    macd: m,
    signal: signal[i] || 0,
    histogram: m - (signal[i] || 0),
  }));
}

function calculateEMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  let ema = prices[0];
  result.push(ema);

  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
    result.push(ema);
  }

  return result;
}

function calculateBollingerBands(
  prices: number[],
  period: number
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateMA(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }

    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b) / period;
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push((middle[i] || 0) + stdDev * 2);
    lower.push((middle[i] || 0) - stdDev * 2);
  }

  return { upper, middle, lower };
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
