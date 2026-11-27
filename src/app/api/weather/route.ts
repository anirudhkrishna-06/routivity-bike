import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const key = process.env.WEATHERAPI; const q = new URL(request.url).searchParams.get("q");
  if (!key || !q) return NextResponse.json({ error: "Weather unavailable" }, { status: 400 });
  try { const response = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&days=2&aqi=no&alerts=yes`, { next: { revalidate: 900 } }); if (!response.ok) return NextResponse.json({ error: "Weather unavailable" }, { status: response.status }); return NextResponse.json(await response.json()); } catch { return NextResponse.json({ error: "Weather unavailable" }, { status: 502 }); }
}
