"use client";

import { useEffect, useState, useRef } from "react";
import { formatUsd, formatPercent } from "@/lib/utils";

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

interface AdvancedChartProps {
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
}

export default function AdvancedTradingChart({
  pair,
  timeframe,
  chartType,
  indicators,
}: AdvancedChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicatorData, setIndicatorData] = useState<ChartIndicators>({});
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [crosshair, setCrosshair] = useState<CrosshairData | null>(null);
  const [stats, setStats] = useState({ high: 0, low: 0, change: 0 });

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
  }, [timeframe]);

  // Calculate indicators
  useEffect(() => {
    if (candles.length === 0) return;

    const newIndicators: ChartIndicators = {};
    const closes = candles.map((c) => c.close);

    // Moving Averages
    if (indicators.ma20) {
      newIndicators.ma20 = calculateMA(closes, 20);
    }
    if (indicators.ma50) {
      newIndicators.ma50 = calculateMA(closes, 50);
    }
    if (indicators.ma200) {
      newIndicators.ma200 = calculateMA(closes, 200);
    }

    // RSI
    if (indicators.rsi) {
      newIndicators.rsi = calculateRSI(closes, 14);
    }

    // MACD
    if (indicators.macd) {
      newIndicators.macd = calculateMACD(closes);
    }

    // Bollinger Bands
    if (indicators.bollinger) {
      newIndicators.bollinger = calculateBollingerBands(closes, 20);
    }

    // Volume
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

    canvas.width = rect.width;
    canvas.height = rect.height;

    const chartHeight = canvas.height * 0.75;
    const volumeHeight = canvas.height * 0.25;
    const padding = 50;
    const chartWidth = canvas.width - padding * 2;

    // Background
    ctx.fillStyle = "#0a0e27";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = "rgba(90, 106, 138, 0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = (chartHeight / 10) * i + padding;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
    }

    // Calculate price range
    const high = Math.max(...candles.map((c) => c.high));
    const low = Math.min(...candles.map((c) => c.low));
    const range = high - low || 1;
    const pricePerPixel = chartHeight / range;

    // Draw volume
    if (indicators.volume) {
      const maxVolume = Math.max(...candles.map((c) => c.volume));
      const volumeScaleFactor = volumeHeight / maxVolume;

      candles.forEach((candle, i) => {
        const x = padding + (i / candles.length) * chartWidth;
        const width = Math.max(chartWidth / candles.length * 0.7, 1);
        const volumeY = chartHeight + padding + volumeHeight - candle.volume * volumeScaleFactor;
        const isUp = candle.close >= candle.open;

        ctx.fillStyle = isUp ? "rgba(0, 230, 118, 0.3)" : "rgba(255, 82, 82, 0.3)";
        ctx.fillRect(x - width / 2, volumeY, width, candle.volume * volumeScaleFactor);
      });
    }

    // Draw Bollinger Bands
    if (indicators.bollinger && indicatorData.bollinger) {
      ctx.strokeStyle = "rgba(255, 193, 7, 0.4)";
      ctx.lineWidth = 1;
      drawLine(ctx, indicatorData.bollinger.upper, padding, chartHeight, chartWidth, range, low);

      ctx.strokeStyle = "rgba(100, 150, 255, 0.4)";
      drawLine(ctx, indicatorData.bollinger.middle, padding, chartHeight, chartWidth, range, low);

      ctx.strokeStyle = "rgba(255, 193, 7, 0.4)";
      drawLine(ctx, indicatorData.bollinger.lower, padding, chartHeight, chartWidth, range, low);
    }

    // Draw moving averages
    if (indicators.ma20 && indicatorData.ma20) {
      ctx.strokeStyle = "#ff9800";
      ctx.lineWidth = 1.5;
      drawLine(ctx, indicatorData.ma20, padding, chartHeight, chartWidth, range, low);
    }

    if (indicators.ma50 && indicatorData.ma50) {
      ctx.strokeStyle = "#2196f3";
      ctx.lineWidth = 1.5;
      drawLine(ctx, indicatorData.ma50, padding, chartHeight, chartWidth, range, low);
    }

    if (indicators.ma200 && indicatorData.ma200) {
      ctx.strokeStyle = "#9c27b0";
      ctx.lineWidth = 1.5;
      drawLine(ctx, indicatorData.ma200, padding, chartHeight, chartWidth, range, low);
    }

    // Draw candlesticks
    candles.forEach((candle, i) => {
      const x = padding + (i / candles.length) * chartWidth;
      const width = Math.max(chartWidth / candles.length * 0.6, 1);

      // Price positions
      const openY = chartHeight + padding - (candle.open - low) * pricePerPixel;
      const closeY = chartHeight + padding - (candle.close - low) * pricePerPixel;
      const highY = chartHeight + padding - (candle.high - low) * pricePerPixel;
      const lowY = chartHeight + padding - (candle.low - low) * pricePerPixel;

      const isUp = candle.close >= candle.open;
      const color = isUp ? "#00e676" : "#ff5252";

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
      ctx.fillRect(x - width / 2, bodyTop, width, bodyHeight);

      // Hover highlight
      if (hoveredIndex === i) {
        ctx.strokeStyle = "rgba(0, 229, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - width / 2 - 2, padding - 5, width + 4, chartHeight + 10);
      }
    });

    // Price axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const price = low + (range / 5) * i;
      const y = chartHeight + padding - (range / 5) * i * pricePerPixel;
      ctx.fillText(formatUsd(price), padding - 10, y + 4);
    }

    // Time axis labels
    ctx.textAlign = "center";
    const timeInterval = Math.floor(candles.length / 6);
    for (let i = 0; i < candles.length; i += timeInterval) {
      const x = padding + (i / candles.length) * chartWidth;
      const date = new Date(candles[i].time);
      ctx.fillText(date.toLocaleDateString(), x, canvas.height - 10);
    }
  }, [candles, indicatorData, indicators, hoveredIndex]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const padding = 50;
    const chartWidth = rect.width - padding * 2;
    const index = Math.floor(((x - padding) / chartWidth) * candles.length);

    if (index >= 0 && index < candles.length) {
      setHoveredIndex(index);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-bg-elevated rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}

// ── Utility Functions ────────────────────────────────────────────

function calculateMA(data: number[], period: number): number[] {
  return data.map((_, i) => {
    if (i < period - 1) return NaN;
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    return sum / period;
  });
}

function calculateRSI(data: number[], period: number): number[] {
  const deltas = data.slice(1).map((val, i) => val - data[i]);
  const gains = deltas.map((delta) => (delta > 0 ? delta : 0));
  const losses = deltas.map((delta) => (delta < 0 ? Math.abs(delta) : 0));

  const rsi: number[] = [];
  for (let i = period; i < data.length; i++) {
    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b) / period;
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b) / period;
    const rs = avgLoss === 0 ? 0 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return Array(period).fill(NaN).concat(rsi);
}

function calculateMACD(data: number[]): { macd: number; signal: number; histogram: number }[] {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  const macdLine = ema12.map((val, i) => val - ema26[i]);
  const signalLine = calculateEMA(macdLine, 9);

  return macdLine.map((val, i) => ({
    macd: val,
    signal: signalLine[i],
    histogram: val - signalLine[i],
  }));
}

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  ema.push(sum / period);

  for (let i = period; i < data.length; i++) {
    const newEMA = (data[i] - ema[i - period]) * multiplier + ema[i - period];
    ema.push(newEMA);
  }

  return Array(period - 1).fill(NaN).concat(ema);
}

function calculateBollingerBands(
  data: number[],
  period: number
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const subset = data.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance =
      subset.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push(mean + stdDev * 2);
    lower.push(mean - stdDev * 2);
  }

  return {
    middle,
    upper: Array(period - 1).fill(NaN).concat(upper),
    lower: Array(period - 1).fill(NaN).concat(lower),
  };
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  data: number[],
  paddingX: number,
  chartHeight: number,
  chartWidth: number,
  range: number,
  minPrice: number
) {
  const validData = data.filter((v) => !isNaN(v));
  if (validData.length < 2) return;

  ctx.beginPath();
  data.forEach((value, i) => {
    if (isNaN(value)) return;
    const x = paddingX + (i / data.length) * chartWidth;
    const y = chartHeight + paddingX - ((value - minPrice) / range) * chartHeight;

    if (isNaN(ctx.canvas.width)) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}
