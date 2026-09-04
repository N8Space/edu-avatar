import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({
        status: "healthy",
        service: "edu-avatar",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        integrations: {
            gemini_flash_models: Boolean(process.env.GOOGLE_API_KEY),
            remotion_video_engine: true,
            n8n_security_telemetry: "https://automation.lesterlabs.cloud",
            google_drive_folder: "1bogWnsdHz_qjW-AHA5y9QAHWa7PdTQLw",
        },
    });
}
