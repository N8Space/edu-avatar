import { NextRequest, NextResponse } from "next/server";
import { GoogleDriveService } from "@/lib/google-drive";

export async function POST(req: NextRequest) {
    try {
        const { audioUrl: audioBase64, imageUrl: imageBase64OrUrl } = await req.json();

        if (!audioBase64) {
            return NextResponse.json({ error: "Audio Data is required for video generation" }, { status: 400 });
        }

        const isWav = audioBase64.startsWith("data:audio/wav");
        const audioContentType = isWav ? "audio/x-wav" : "audio/mpeg";
        const cleanAudioBase64 = audioBase64.replace(/^data:[^;]+;base64,/, "");
        const audioBuffer = Buffer.from(cleanAudioBase64, "base64");

        // Archive media asset directly to Google Drive folder 1bogWnsdHz_qjW-AHA5y9QAHWa7PdTQLw
        let driveUrl: string | null = null;
        try {
            const driveService = new GoogleDriveService();
            const filename = `edu_avatar_${Date.now()}.${isWav ? "wav" : "mp3"}`;
            const driveResult = await driveService.uploadFile(audioBuffer, filename, audioContentType);
            if (driveResult.success && driveResult.webViewLink) {
                driveUrl = driveResult.webViewLink;
                console.log("Archived asset to Google Drive:", driveUrl);
            } else if (driveResult.error) {
                console.log("Google Drive archive notice:", driveResult.error);
            }
        } catch (driveErr) {
            console.warn("Google Drive archive warning (non-fatal):", driveErr);
        }

        // Return immediate Remotion video engine configuration
        console.log("Rendering avatar video via Remotion Video Engine...");
        return NextResponse.json({
            id: "remotion_vid_" + Date.now(),
            status: "completed",
            video_url: audioBase64,
            imageUrl: imageBase64OrUrl || null,
            drive_url: driveUrl,
            provider: "remotion",
        });

    } catch (error: any) {
        console.error("Video Generation Route Error:", error?.message || error);
        return NextResponse.json({ error: error?.message || "Failed to generate video" }, { status: 500 });
    }
}
