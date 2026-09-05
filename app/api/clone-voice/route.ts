import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as File;
        const customApiKey = (formData.get("apiKey") as string)?.trim();

        if (!audioFile) {
            return NextResponse.json({ error: "Audio file is required for voice cloning" }, { status: 400 });
        }

        const apiKey = customApiKey || process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                error: "ElevenLabs API Key not found. Please provide an API key in settings or configure ELEVENLABS_API_KEY.",
                requiresKey: true
            }, { status: 400 });
        }

        if (!apiKey.startsWith("sk_")) {
            return NextResponse.json({
                error: "API key ID used as API key. ElevenLabs secret keys start with 'sk_'. Please copy the Secret Key from ElevenLabs (Developers -> API Keys).",
                status: "api_key_id_used_as_api_key",
                fallbackToGemini: true,
            }, { status: 400 });
        }

        console.log("Submitting voice sample to ElevenLabs Instant Voice Cloning...");
        const elevenLabsFormData = new FormData();
        elevenLabsFormData.append("name", "EduAvatar User Voice " + Date.now().toString().slice(-4));
        elevenLabsFormData.append("files", audioFile);
        elevenLabsFormData.append("description", "Cloned voice sample from Edu-Avatar studio");

        const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
            method: "POST",
            headers: {
                "xi-api-key": apiKey,
            },
            body: elevenLabsFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn("ElevenLabs Voice Clone API returned status:", response.status, errorText);

            let message = "Failed to clone voice with ElevenLabs.";
            let lacksPermission = false;

            try {
                const parsed = JSON.parse(errorText);
                if (
                    parsed?.detail?.status === "missing_permissions" ||
                    parsed?.detail?.message?.includes("voices_write") ||
                    parsed?.detail?.message?.includes("permission")
                ) {
                    message = "Your ElevenLabs API key is missing 'voices_write' permission. Instant Voice Cloning requires an ElevenLabs Starter or Creator paid subscription. Falling back to Gemini Zero-SaaS Voice Matching.";
                    lacksPermission = true;
                } else if (parsed?.detail?.message) {
                    message = parsed.detail.message;
                }
            } catch {
                message = `ElevenLabs API error: ${response.statusText}`;
            }

            return NextResponse.json({
                error: message,
                lacksPermission,
                fallbackToGemini: true,
            }, { status: response.status });
        }

        const data = await response.json();
        const voiceId = data.voice_id;
        console.log("ElevenLabs Voice Cloned successfully. Voice ID:", voiceId);

        return NextResponse.json({
            success: true,
            voice_id: voiceId,
            provider: "elevenlabs"
        });

    } catch (error: any) {
        console.error("Voice Clone Route Error:", error?.message || error);
        return NextResponse.json({
            error: error?.message || "Failed to clone voice",
            fallbackToGemini: true,
        }, { status: 500 });
    }
}

