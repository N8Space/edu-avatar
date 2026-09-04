import { NextRequest, NextResponse } from "next/server";

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

async function generateGeminiAudio(text: string): Promise<string | null> {
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) return null;

    try {
        console.log("Generating Audio via Gemini TTS fallback...");
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${googleApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Please read the following text clearly and naturally:\n\n${text}` }] }],
                generationConfig: { responseModalities: ["AUDIO"] }
            })
        });

        if (!res.ok) {
            const err = await res.text();
            console.error("Gemini TTS fallback failed:", err);
            return null;
        }

        const data = await res.json();
        const base64Pcm = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Pcm) {
            console.error("No audio data returned from Gemini TTS");
            return null;
        }

        const pcmBuffer = Buffer.from(base64Pcm, "base64");
        const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
        console.log("Gemini TTS fallback generated WAV successfully:", wavBuffer.length, "bytes");
        return `data:audio/wav;base64,${wavBuffer.toString("base64")}`;
    } catch (e) {
        console.error("Gemini TTS Error:", e);
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { text, voiceId = "21m00Tcm4TlvDq8ikWAM" } = await req.json(); // Default voice: Rachel

        if (!text) {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;

        // Try ElevenLabs first if key is present
        if (apiKey) {
            try {
                const response = await fetch(
                    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                    {
                        method: "POST",
                        headers: {
                            "Accept": "audio/mpeg",
                            "Content-Type": "application/json",
                            "xi-api-key": apiKey,
                        },
                        body: JSON.stringify({
                            text,
                            model_id: "eleven_multilingual_v2",
                            voice_settings: {
                                stability: 0.5,
                                similarity_boost: 0.5,
                            },
                        }),
                    }
                );

                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const base64Audio = buffer.toString("base64");
                    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
                    return NextResponse.json({ audioUrl });
                }

                const errorText = await response.text();
                console.warn("ElevenLabs Audio Generation Failed:", errorText);

                // If ElevenLabs fails due to plan restriction (e.g. Free user library voices), fall back to Gemini TTS
                const fallbackAudioUrl = await generateGeminiAudio(text);
                if (fallbackAudioUrl) {
                    console.log("Using Gemini TTS fallback audio for pipeline");
                    return NextResponse.json({ audioUrl: fallbackAudioUrl, provider: "gemini" });
                }

                let message = `ElevenLabs API error: ${response.statusText}`;
                try {
                    const parsed = JSON.parse(errorText);
                    if (parsed?.detail?.message) message = parsed.detail.message;
                } catch {}
                return NextResponse.json({ error: message }, { status: response.status });

            } catch (elevenErr) {
                console.warn("ElevenLabs request error, trying Gemini fallback:", elevenErr);
                const fallbackAudioUrl = await generateGeminiAudio(text);
                if (fallbackAudioUrl) {
                    return NextResponse.json({ audioUrl: fallbackAudioUrl, provider: "gemini" });
                }
                throw elevenErr;
            }
        }

        // Fallback to Gemini TTS if no ElevenLabs key
        const fallbackAudioUrl = await generateGeminiAudio(text);
        if (fallbackAudioUrl) {
            return NextResponse.json({ audioUrl: fallbackAudioUrl, provider: "gemini" });
        }

        return NextResponse.json({ error: "No voice generation provider available" }, { status: 500 });

    } catch (error: any) {
        console.error("Audio Generation Error:", error);
        return NextResponse.json({ error: error?.message || "Failed to generate audio" }, { status: 500 });
    }
}
