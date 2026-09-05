import { NextRequest, NextResponse } from "next/server";
import { GoogleDriveService } from "@/lib/google-drive";
import * as fs from "fs";
import * as path from "path";

export async function POST(req: NextRequest) {
    try {
        const { video_id, heygenApiKey } = await req.json();

        if (!video_id) {
            return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
        }

        // Remotion dynamic videos render in-browser immediately
        if (video_id.startsWith("remotion_vid_")) {
            return NextResponse.json({
                status: "completed",
                video_id,
                provider: "remotion",
                message: "Remotion video engine active and ready",
            });
        }

        // HeyGen Video Status Check
        const apiKey = (heygenApiKey || process.env.HEYGEN_API_KEY || "").trim();
        if (!apiKey) {
            return NextResponse.json({ error: "HeyGen API Key is missing" }, { status: 400 });
        }

        const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${video_id}`, {
            headers: {
                "X-Api-Key": apiKey,
            },
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HeyGen API error (${response.status}): ${err}`);
        }

        const data = await response.json();
        const currentStatus = data.data?.status || data.status;
        console.log(`HeyGen Video Status [${video_id}]: ${currentStatus}`);

        if (currentStatus === "completed") {
            const videoUrl = data.data?.video_url || data.video_url;
            let localDownloadUrl: string | null = null;
            let driveUrl: string | null = null;

            if (videoUrl) {
                try {
                    const downloadRes = await fetch(videoUrl);
                    if (downloadRes.ok) {
                        const videoBuffer = Buffer.from(await downloadRes.arrayBuffer());

                        // Save MP4 locally to public/generated
                        const publicDir = path.join(process.cwd(), "public", "generated");
                        if (!fs.existsSync(publicDir)) {
                            fs.mkdirSync(publicDir, { recursive: true });
                        }
                        const filename = `edu_avatar_${video_id}.mp4`;
                        fs.writeFileSync(path.join(publicDir, filename), videoBuffer);
                        localDownloadUrl = `/generated/${filename}`;
                        console.log("Cached HeyGen MP4 video locally:", localDownloadUrl);

                        // Archive MP4 to Google Drive
                        try {
                            const driveService = new GoogleDriveService();
                            const driveResult = await driveService.uploadFile(videoBuffer, filename, "video/mp4");
                            if (driveResult.success && driveResult.webViewLink) {
                                driveUrl = driveResult.webViewLink;
                                console.log("Archived HeyGen MP4 video to Google Drive:", driveUrl);
                            }
                        } catch (driveErr) {
                            console.warn("Google Drive upload of HeyGen video warning:", driveErr);
                        }
                    }
                } catch (saveErr) {
                    console.warn("Error caching HeyGen video:", saveErr);
                }
            }

            return NextResponse.json({
                status: "completed",
                video_url: videoUrl,
                local_download_url: localDownloadUrl,
                drive_url: driveUrl,
                provider: "heygen",
            });
        }

        if (currentStatus === "failed" || currentStatus === "error") {
            return NextResponse.json({
                status: "failed",
                error: data.data?.error || data.error || "HeyGen video generation failed",
            });
        }

        return NextResponse.json({
            status: "processing",
            progress: data.data?.progress || 50,
            video_id,
            provider: "heygen",
        });

    } catch (error: any) {
        console.error("HeyGen Status API Error:", error);
        return NextResponse.json({ error: error?.message || "Failed to check video status" }, { status: 500 });
    }
}
