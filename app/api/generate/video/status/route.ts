import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { video_id } = await req.json();

        if (!video_id) {
            return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
        }

        // Remotion dynamic videos render in-browser immediately
        return NextResponse.json({
            status: "completed",
            video_id,
            provider: "remotion",
            message: "Remotion video engine active and ready",
        });

    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Failed to check video status" }, { status: 500 });
    }
}
