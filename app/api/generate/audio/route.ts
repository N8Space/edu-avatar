import { NextRequest, NextResponse } from "next/server";

/**
 * Encapsulates raw 16-bit linear PCM audio into a standard 44-byte RIFF WAV container.
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataLength = pcmBuffer.length;
    const buffer = Buffer.alloc(44 + dataLength);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataLength, 40);
    pcmBuffer.copy(buffer, 44);

    return buffer;
}

/**
 * Helper to analyze a voice sample with Gemini to match vocal characteristics.
 */
async function analyzeVoiceSample(voiceSampleUrl: string, googleApiKey: string): Promise<{ voiceName: string; description: string }> {
    try {
        const mimeMatch = voiceSampleUrl.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "audio/webm";
        const base64Data = voiceSampleUrl.replace(/^data:[^;]+;base64,/, "");

        const prompt = `Analyze this speaker's voice in the provided audio sample.
Determine the speaker's vocal profile:
1. Gender (Male, Female, or Neutral)
2. Pitch (Deep, Medium, High)
3. Cadence & Energy (Calm, Warm, Dynamic, Fast, Authoritative)

Based on your analysis, choose the single BEST matching voice from Google's prebuilt voices:
- "Charon": Deep, warm, authoritative, calm male voice.
- "Puck": Clear, friendly, engaging, middle-pitch male voice.
- "Fenrir": Strong, resonant, assertive male voice.
- "Aoede": Warm, expressive, educational, articulate female voice.
- "Kore": Friendly, bright, higher-pitch female voice.
- "Leda": Gentle, poised, soft female voice.
- "Orus": Dynamic, direct, conversational male voice.
- "Zephyr": Bright, fast, high-energy female voice.

Respond ONLY with valid JSON in this exact structure:
{
  "voiceName": "Charon" | "Puck" | "Fenrir" | "Aoede" | "Kore" | "Leda" | "Orus" | "Zephyr",
  "gender": "male" | "female",
  "description": "Brief description of why this voice matches"
}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType, data: base64Data } },
                        { text: prompt }
                    ]
                }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (res.ok) {
            const data = await res.json();
            const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResponse) {
                const parsed = JSON.parse(textResponse);
                if (parsed?.voiceName) {
                    console.log(`Gemini Voice Match Analysis: Selected ${parsed.voiceName} (${parsed.description || ""})`);
                    return { voiceName: parsed.voiceName, description: parsed.description || "Voice matched" };
                }
            }
        }
    } catch (e: any) {
        console.warn("Voice analysis error (using fallback voice):", e?.message || e);
    }

    return { voiceName: "Puck", description: "Default educational voice" };
}

/**
 * Synthesizes audio using ElevenLabs Instant Voice Clone or Cloned Voice ID.
 */
async function synthesizeWithElevenLabs(
    text: string,
    apiKey: string,
    voiceId: string
): Promise<{ audioUrl: string; provider: string } | null> {
    try {
        console.log(`Synthesizing 30-second script via ElevenLabs (Voice ID: ${voiceId})...`);
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: "POST",
            headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn("ElevenLabs TTS failed:", response.status, errorText);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString("base64");
        return {
            audioUrl: `data:audio/mpeg;base64,${base64Audio}`,
            provider: "elevenlabs"
        };
    } catch (err: any) {
        console.warn("ElevenLabs TTS Exception:", err?.message || err);
        return null;
    }
}

/**
 * Synthesizes audio using Google Gemini 2.5 Flash TTS with voiceConfig.
 */
async function synthesizeWithGemini(
    text: string,
    voiceName: string,
    googleApiKey: string
): Promise<{ audioUrl: string; provider: string; voiceName: string; durationHint: number }> {
    console.log(`Synthesizing speech via Gemini 2.5 Flash TTS (Voice: ${voiceName})...`);

    const promptText = `Please read the following 30-second educational script clearly, engagingly, and naturally:\n\n${text}`;
    const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName
                    }
                }
            }
        }
    };

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${googleApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini TTS synthesis failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const base64Pcm = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Pcm) {
        throw new Error("Gemini TTS returned no audio content");
    }

    const pcmBuffer = Buffer.from(base64Pcm, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
    const audioUrl = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;

    return {
        audioUrl,
        provider: "gemini_tts",
        voiceName,
        durationHint: Math.round(pcmBuffer.length / (24000 * 2)),
    };
}

export async function POST(req: NextRequest) {
    try {
        const {
            text,
            voiceSampleUrl,
            elevenlabsApiKey,
            voiceId
        } = await req.json();

        if (!text || typeof text !== "string" || text.trim().length === 0) {
            return NextResponse.json({ error: "Text is required for audio synthesis" }, { status: 400 });
        }

        const effectiveElevenLabsKey = (elevenlabsApiKey || process.env.ELEVENLABS_API_KEY || "").trim();

        // Check if key is accidentally an API Key ID instead of the secret key
        if (effectiveElevenLabsKey && !effectiveElevenLabsKey.startsWith("sk_")) {
            console.warn("⚠️ ElevenLabs Key Warning: API keys start with 'sk_'. The key provided appears to be an API Key ID. Please copy the Secret Key from https://elevenlabs.io/app/developers/api-keys. Falling back to Gemini Zero-SaaS Voice Match.");
        }

        // ---------------------------------------------------------------------
        // Tier 1: ElevenLabs Voice Cloning Synthesis
        // ---------------------------------------------------------------------
        if (effectiveElevenLabsKey && effectiveElevenLabsKey.startsWith("sk_") && (voiceId || voiceSampleUrl)) {
            let activeVoiceId = voiceId;

            // If we don't have a voiceId yet, but have a sample, clone it first
            if (!activeVoiceId && voiceSampleUrl) {
                try {
                    console.log("Cloning voice sample with ElevenLabs...");
                    const cleanBase64 = voiceSampleUrl.replace(/^data:[^;]+;base64,/, "");
                    const audioBuffer = Buffer.from(cleanBase64, "base64");

                    const formData = new FormData();
                    formData.append("name", `EduAvatar Voice ${Date.now().toString().slice(-4)}`);
                    formData.append("files", new Blob([audioBuffer], { type: "audio/webm" }), "voice_sample.webm");
                    formData.append("description", "Voice sample for educational script synthesis");

                    const cloneRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
                        method: "POST",
                        headers: { "xi-api-key": effectiveElevenLabsKey },
                        body: formData,
                    });

                    if (cloneRes.ok) {
                        const cloneData = await cloneRes.json();
                        activeVoiceId = cloneData.voice_id;
                        console.log("Successfully cloned ElevenLabs voice ID:", activeVoiceId);
                    } else {
                        const err = await cloneRes.text();
                        console.warn("ElevenLabs clone returned error, will fall back to Gemini:", err);
                    }
                } catch (cloneErr) {
                    console.warn("ElevenLabs cloning attempt failed:", cloneErr);
                }
            }

            if (activeVoiceId) {
                const elevenResult = await synthesizeWithElevenLabs(text, effectiveElevenLabsKey, activeVoiceId);
                if (elevenResult) {
                    return NextResponse.json({
                        audioUrl: elevenResult.audioUrl,
                        provider: "elevenlabs",
                        format: "mp3",
                        voiceId: activeVoiceId,
                        message: "Synthesized using ElevenLabs Cloned Voice"
                    });
                }
            }
        }

        // ---------------------------------------------------------------------
        // Tier 2: Zero-SaaS Voice Matching Fallback (Google Gemini)
        // ---------------------------------------------------------------------
        const googleApiKey = process.env.GOOGLE_API_KEY;
        if (!googleApiKey) {
            return NextResponse.json({ error: "Server configuration error: Missing GOOGLE_API_KEY" }, { status: 500 });
        }

        let selectedVoice = "Puck";
        let matchDescription = "Default educational voice";

        if (voiceSampleUrl && typeof voiceSampleUrl === "string" && voiceSampleUrl.startsWith("data:audio/")) {
            console.log("Analyzing user voice sample for Gemini Zero-SaaS Voice Matching...");
            const analysis = await analyzeVoiceSample(voiceSampleUrl, googleApiKey);
            selectedVoice = analysis.voiceName;
            matchDescription = analysis.description;
        }

        const geminiResult = await synthesizeWithGemini(text, selectedVoice, googleApiKey);

        return NextResponse.json({
            audioUrl: geminiResult.audioUrl,
            provider: "gemini_tts",
            voiceName: selectedVoice,
            format: "wav",
            durationHint: geminiResult.durationHint,
            voiceMatchDescription: matchDescription,
        });

    } catch (error: any) {
        console.error("Audio Generation Error:", error?.message || error);
        return NextResponse.json({ error: error?.message || "Failed to synthesize audio" }, { status: 500 });
    }
}
