import { NextRequest, NextResponse } from "next/server";
import { GoogleDriveService } from "@/lib/google-drive";

export async function POST(req: NextRequest) {
    try {
        const { video_id } = await req.json();

        if (!video_id) {
            return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
        }

        // If it's our mock ID
        if (video_id.startsWith("mock_job_id_")) {
            // Simulate processing delay
            return NextResponse.json({
                data: {
                    status: "completed",
                    video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", // Sample video
                    thumbnail_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&auto=format&fit=crop&q=60"
                }
            });
        }

        const apiKey = process.env.HEYGEN_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Service configuration error" }, { status: 500 });
        }

        const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${video_id}`, {
            headers: {
                "X-Api-Key": apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(`HeyGen API error: ${response.statusText}`);
        }

        const data = await response.json();
        const currentStatus = data.data?.status || data.status;
        console.log(`Video Status [${video_id}]: ${currentStatus}`);

        if (currentStatus === 'completed') {
            const videoUrl = data.data?.video_url || data.video_url;
            if (videoUrl && !data.data?.drive_url) {
                try {
                    const driveService = new GoogleDriveService();
                    const downloadRes = await fetch(videoUrl);
                    if (downloadRes.ok) {
                        const videoBuffer = Buffer.from(await downloadRes.arrayBuffer());
                        const driveResult = await driveService.uploadFile(
                            videoBuffer,
                            `edu_avatar_${video_id}.mp4`,
                            'video/mp4'
                        );
                        if (driveResult.success && driveResult.webViewLink) {
                            if (data.data) {
                                data.data.drive_url = driveResult.webViewLink;
                            }
                            data.drive_url = driveResult.webViewLink;
                        }
                    }
                } catch (driveErr) {
                    console.warn("Google Drive archive of HeyGen video failed (non-fatal):", driveErr);
                }
            }
        }

        if (currentStatus === 'failed' || currentStatus === 'error') {
            console.error("HeyGen Failure Details:", JSON.stringify(data, null, 2));
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error("HeyGen Status API Error:", error);
        return NextResponse.json({ error: "Failed to check video status" }, { status: 500 });
    }
}
