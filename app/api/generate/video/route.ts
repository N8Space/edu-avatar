import { NextRequest, NextResponse } from "next/server";
import { GoogleDriveService } from "@/lib/google-drive";

// ------------------------------------------------------------------
// HeyGen Helper: Upload Audio Asset Directly to HeyGen
// ------------------------------------------------------------------
async function uploadHeyGenAudioDirect(buffer: Buffer, contentType: string, apiKey: string): Promise<string | null> {
    try {
        console.log(`Uploading Audio directly to HeyGen (${contentType}, ${buffer.byteLength} bytes)...`);
        const response = await fetch("https://upload.heygen.com/v1/asset", {
            method: "POST",
            headers: {
                "X-Api-Key": apiKey,
                "Content-Type": contentType,
            },
            body: buffer as unknown as BodyInit,
        });

        if (!response.ok) {
            const raw = await response.text();
            console.warn("HeyGen Audio Upload Failed:", raw);
            return null;
        }

        const data = await response.json();
        console.log("HeyGen Audio Asset Uploaded:", data?.data?.id);
        return data?.data?.id || null;
    } catch (e) {
        console.warn("HeyGen Audio Upload Error:", e);
        return null;
    }
}

// ------------------------------------------------------------------
// HeyGen Helper: Upload or Resolve Talking Photo ID
// ------------------------------------------------------------------
async function resolveHeyGenTalkingPhoto(imageBase64OrUrl: string | null, apiKey: string): Promise<string | null> {
    const DEFAULT_FALLBACK_PHOTO_ID = "176c70211a3244369083a848d60f9caf";

    if (!imageBase64OrUrl) {
        return DEFAULT_FALLBACK_PHOTO_ID;
    }

    try {
        let buffer: Buffer;
        let contentType = "image/jpeg";

        if (imageBase64OrUrl.startsWith("data:")) {
            const mimeMatch = imageBase64OrUrl.match(/^data:([^;]+);base64,/);
            if (mimeMatch) contentType = mimeMatch[1];
            const clean = imageBase64OrUrl.replace(/^data:[^;]+;base64,/, "");
            buffer = Buffer.from(clean, "base64");
        } else {
            const imgRes = await fetch(imageBase64OrUrl);
            if (!imgRes.ok) return DEFAULT_FALLBACK_PHOTO_ID;
            contentType = imgRes.headers.get("content-type") || "image/jpeg";
            buffer = Buffer.from(await imgRes.arrayBuffer());
        }

        console.log(`Uploading Talking Photo to HeyGen (${contentType}, ${buffer.byteLength} bytes)...`);
        const response = await fetch("https://upload.heygen.com/v1/talking_photo", {
            method: "POST",
            headers: {
                "X-Api-Key": apiKey,
                "Content-Type": contentType,
            },
            body: buffer as unknown as BodyInit,
        });

        if (response.ok) {
            const data = await response.json();
            if (data?.data?.talking_photo_id) {
                console.log("HeyGen New Photo ID:", data.data.talking_photo_id);
                return data.data.talking_photo_id;
            }
        }

        const errText = await response.text();
        console.warn("HeyGen Photo Upload failed, falling back to existing avatar:", errText);

        // Fallback: Query user's existing talking photos
        try {
            const listRes = await fetch("https://api.heygen.com/v1/talking_photo.list", {
                headers: { "X-Api-Key": apiKey },
            });
            if (listRes.ok) {
                const listData = await listRes.json();
                const custom = listData?.data?.filter((p: any) => !p.is_preset);
                if (custom && custom.length > 0) {
                    return custom[0].id;
                }
            }
        } catch {}

        return DEFAULT_FALLBACK_PHOTO_ID;

    } catch (e) {
        console.warn("HeyGen Talking Photo error, using fallback avatar:", e);
        return DEFAULT_FALLBACK_PHOTO_ID;
    }
}

// ------------------------------------------------------------------
// Main Handler
// ------------------------------------------------------------------
export async function POST(req: NextRequest) {
    try {
        const { audioUrl: audioBase64, imageUrl: imageBase64OrUrl } = await req.json();

        if (!audioBase64) {
            return NextResponse.json({ error: "Audio Data is required" }, { status: 400 });
        }

        const isWav = audioBase64.startsWith("data:audio/wav");
        const audioContentType = isWav ? "audio/x-wav" : "audio/mpeg";
        const cleanAudioBase64 = audioBase64.replace(/^data:[^;]+;base64,/, "");
        const audioBuffer = Buffer.from(cleanAudioBase64, "base64");

        const heyGenApiKey = process.env.HEYGEN_API_KEY;

        if (heyGenApiKey) {
            try {
                // 1. Upload audio buffer directly to HeyGen (No n8n needed)
                const audioAssetId = await uploadHeyGenAudioDirect(audioBuffer, audioContentType, heyGenApiKey);

                // 2. Resolve or upload photo
                const talkingPhotoId = await resolveHeyGenTalkingPhoto(imageBase64OrUrl, heyGenApiKey);

                if (audioAssetId && talkingPhotoId) {
                    console.log("Calling HeyGen Video Generation API...");
                    const heyGenRes = await fetch("https://api.heygen.com/v2/video/generate", {
                        method: "POST",
                        headers: {
                            "X-Api-Key": heyGenApiKey,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            video_inputs: [
                                {
                                    character: {
                                        type: "talking_photo",
                                        talking_photo_id: talkingPhotoId,
                                    },
                                    voice: {
                                        type: "audio",
                                        audio_asset_id: audioAssetId,
                                    },
                                    background: {
                                        type: "color",
                                        value: "#000000",
                                    },
                                },
                            ],
                            dimension: { width: 1280, height: 720 },
                        }),
                    });

                    const heyGenData = await heyGenRes.json().catch(() => null);

                    if (heyGenRes.ok && heyGenData?.data?.video_id) {
                        return NextResponse.json({
                            id: heyGenData.data.video_id,
                            status: "processing",
                            message: "Video generation started",
                        });
                    }

                    console.warn("HeyGen video generation refused, falling back to animated audio player:", heyGenData?.error?.message || heyGenRes.statusText);
                }
            } catch (heyGenErr) {
                console.warn("HeyGen pipeline encountered an error, falling back to animated player:", heyGenErr);
            }
        }

        // Archive audio asset to Google Drive folder 1bogWnsdHz_qjW-AHA5y9QAHWa7PdTQLw
        let driveUrl: string | null = null;
        try {
            const driveService = new GoogleDriveService();
            const filename = `edu_avatar_${Date.now()}.${isWav ? "wav" : "mp3"}`;
            const driveResult = await driveService.uploadFile(audioBuffer, filename, audioContentType);
            if (driveResult.success && driveResult.webViewLink) {
                driveUrl = driveResult.webViewLink;
                console.log("Archived audio to Google Drive:", driveUrl);
            } else if (driveResult.error) {
                console.log("Google Drive archive notice:", driveResult.error);
            }
        } catch (driveErr) {
            console.warn("Google Drive archive warning (non-fatal):", driveErr);
        }

        // Resilient Fallback: Immediate Animated Video with Voice & Subtitles via Remotion
        console.log("Rendering via Remotion Player Mode (Audio Data URI)...");
        return NextResponse.json({
            id: "audio_only_" + Date.now(),
            status: "completed",
            video_url: audioBase64,
            drive_url: driveUrl,
            provider: "remotion",
        });

    } catch (error: any) {
        console.error("Video Generation Route Error:", error);
        return NextResponse.json({ error: error?.message || "Failed to start video generation" }, { status: 500 });
    }
}
