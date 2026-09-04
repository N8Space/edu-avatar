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
            gemini_flash: Boolean(process.env.GOOGLE_API_KEY),
            elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
            heygen: Boolean(process.env.HEYGEN_API_KEY),
            n8n_automation_node: "https://automation.lesterlabs.cloud",
            google_drive_folder: "1bogWnsdHz_qjW-AHA5y9QAHWa7PdTQLw",
        },
    });
}
