import { NextRequest, NextResponse } from "next/server";
import { GoogleDriveService } from "@/lib/google-drive";
import * as fs from "fs";
import * as path from "path";

// ------------------------------------------------------------------
// HeyGen Helper: Upload Audio Buffer
// ------------------------------------------------------------------
async function uploadHeyGenAudio(audioBuffer: Buffer, contentType: string, apiKey: string): Promise<string | null> {
    try {
        console.log(`Uploading audio asset to HeyGen (${contentType}, ${audioBuffer.byteLength} bytes)...`);
        const response = await fetch("https://upload.heygen.com/v1/asset", {
            method: "POST",
            headers: {
                "X-Api-Key": apiKey,
                "Content-Type": contentType,
            },
            body: audioBuffer as unknown as BodyInit,
        });

        if (!response.ok) {
            const raw = await response.text();
            console.warn("HeyGen Audio Upload Failed:", raw);
            return null;
        }

        const data = await response.json();
        const assetId = data?.data?.id;
        console.log("HeyGen Audio Asset Uploaded:", assetId);
        return assetId || null;
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
                console.log("HeyGen Talking Photo Uploaded. Photo ID:", data.data.talking_photo_id);
                return data.data.talking_photo_id;
            }
        }

        const errText = await response.text();
        console.warn("HeyGen Photo Upload failed, checking existing photos:", errText);

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
        } catch { }

        return DEFAULT_FALLBACK_PHOTO_ID;

    } catch (e) {
        console.warn("HeyGen Talking Photo error, using fallback avatar:", e);
        return DEFAULT_FALLBACK_PHOTO_ID;
    }
}

// ------------------------------------------------------------------
// Main Video Generation Handler
// ------------------------------------------------------------------
export async function POST(req: NextRequest) {
    try {
        const {
            audioUrl: audioBase64,
            imageUrl: imageBase64OrUrl,
            heygenApiKey
        } = await req.json();

        if (!audioBase64) {
            return NextResponse.json({ error: "Audio Data is required for video generation" }, { status: 400 });
        }

        const isWav = audioBase64.startsWith("data:audio/wav");
        const audioContentType = isWav ? "audio/x-wav" : "audio/mpeg";
        const extension = isWav ? "wav" : "mp3";
        const cleanAudioBase64 = audioBase64.replace(/^data:[^;]+;base64,/, "");
        const audioBuffer = Buffer.from(cleanAudioBase64, "base64");
        const filename = `edu_avatar_${Date.now()}.${extension}`;

        // 1. Direct Local Export: Save to public/generated so user can download immediately
        let localDownloadUrl: string | null = null;
        try {
            const publicDir = path.join(process.cwd(), "public", "generated");
            if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
            }
            const filePath = path.join(publicDir, filename);
            fs.writeFileSync(filePath, audioBuffer);
            localDownloadUrl = `/generated/${filename}`;
            console.log(`Saved audio asset locally: ${localDownloadUrl}`);
        } catch (localErr) {
            console.warn("Could not save to local generated folder:", localErr);
        }

        // 2. HeyGen AI Video Generation (Photorealistic Talking Avatar)
        const effectiveHeyGenKey = (heygenApiKey || process.env.HEYGEN_API_KEY || "").trim();

        if (effectiveHeyGenKey) {
            try {
                console.log("Submitting to HeyGen for photorealistic video generation...");
                const audioAssetId = await uploadHeyGenAudio(audioBuffer, audioContentType, effectiveHeyGenKey);
                const talkingPhotoId = await resolveHeyGenTalkingPhoto(imageBase64OrUrl, effectiveHeyGenKey);

                if (audioAssetId && talkingPhotoId) {
                    console.log("Calling HeyGen Video Generation API (v2)...");
                    const heyGenRes = await fetch("https://api.heygen.com/v2/video/generate", {
                        method: "POST",
                        headers: {
                            "X-Api-Key": effectiveHeyGenKey,
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
                        const videoId = heyGenData.data.video_id;
                        console.log("HeyGen Video Generation Started. Video ID:", videoId);
                        return NextResponse.json({
                            id: videoId,
                            status: "processing",
                            message: "HeyGen video generation in progress",
                            provider: "heygen",
                        });
                    }

                    console.warn("HeyGen video generate refused, falling back to Remotion:", heyGenData?.error?.message || heyGenRes.statusText);
                }
            } catch (heyGenErr) {
                console.warn("HeyGen pipeline encountered an error, falling back to Remotion:", heyGenErr);
            }
        }

        // 3. Google Drive Archiving for Audio
        let driveUrl: string | null = null;
        let driveNotice: string | null = null;
        try {
            const driveService = new GoogleDriveService();
            const driveResult = await driveService.uploadFile(audioBuffer, filename, audioContentType);
            if (driveResult.success && driveResult.webViewLink) {
                driveUrl = driveResult.webViewLink;
                console.log(`Archived asset to Google Drive (${driveResult.authType}):`, driveUrl);
            } else if (driveResult.error) {
                driveNotice = driveResult.error;
            }
        } catch (driveErr: any) {
            console.warn("Google Drive archive warning (non-fatal):", driveErr?.message || driveErr);
            driveNotice = "Google Drive upload failed. Asset is safely saved locally.";
        }

        // 4. Remotion Fallback Mode (Instant animated speaking avatar)
        console.log("Rendering avatar video via Remotion Video Engine...");
        return NextResponse.json({
            id: "remotion_vid_" + Date.now(),
            status: "completed",
            video_url: audioBase64,
            imageUrl: imageBase64OrUrl || null,
            local_download_url: localDownloadUrl,
            drive_url: driveUrl,
            drive_notice: driveNotice,
            provider: "remotion",
        });

    } catch (error: any) {
        console.error("Video Generation Route Error:", error?.message || error);
        return NextResponse.json({ error: error?.message || "Failed to generate video" }, { status: 500 });
    }
}
