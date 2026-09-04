import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as File;

        if (!audioFile) {
            return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Service configuration error" }, { status: 500 });
        }
        console.log("Using ElevenLabs Key starting with:", apiKey.substring(0, 5) + "...");

        // Prepare FormData for ElevenLabs
        const elevenLabsFormData = new FormData();
        elevenLabsFormData.append("name", "User Clone " + new Date().toLocaleString());
        elevenLabsFormData.append("files", audioFile);
        elevenLabsFormData.append("description", "Cloned from user recording");

        console.log("Cloning Voice with ElevenLabs...");

        const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
            method: "POST",
            headers: {
                "xi-api-key": apiKey,
                // Note: Do NOT set Content-Type header manually when using FormData, 
                // let fetch set the boundary.
            },
            body: elevenLabsFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("ElevenLabs Voice Clone Failed:", errorText);

            let message = "Failed to clone voice.";
            try {
                const parsed = JSON.parse(errorText);
                if (parsed?.detail?.status === "missing_permissions" || parsed?.detail?.message?.includes("voices_write")) {
                    message = "Your ElevenLabs API key is missing the 'voices_write' permission. Instant Voice Cloning requires an API key with write permissions, which is only supported on paid plans (Starter or higher). You can proceed without voice cloning to use the default voice.";
                } else if (parsed?.detail?.message) {
                    message = parsed.detail.message;
                }
            } catch {
                message = `ElevenLabs API error: ${response.statusText}`;
            }

            return NextResponse.json({ error: message }, { status: response.status });
        }

        const data = await response.json();
        console.log("Voice Cloned Successfully:", data.voice_id);

        return NextResponse.json({ voice_id: data.voice_id });

    } catch (error: any) {
        console.error("Voice Clone Route Error:", error);
        return NextResponse.json({ error: error.message || "Failed to clone voice" }, { status: 500 });
    }
}
