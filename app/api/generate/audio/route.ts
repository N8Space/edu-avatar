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

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        if (!text || typeof text !== "string" || text.trim().length === 0) {
            return NextResponse.json({ error: "Text is required for audio synthesis" }, { status: 400 });
        }

        const googleApiKey = process.env.GOOGLE_API_KEY;
        if (!googleApiKey) {
            return NextResponse.json({ error: "Server configuration error: Missing GOOGLE_API_KEY" }, { status: 500 });
        }

        console.log("Synthesizing speech via Google Gemini 2.5 Flash TTS...");
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${googleApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Please read the following text clearly, educationally, and naturally:\n\n${text}` }] }],
                generationConfig: { responseModalities: ["AUDIO"] }
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Gemini TTS API error:", errText);
            return NextResponse.json({ error: "Gemini TTS synthesis failed", details: errText }, { status: res.status });
        }

        const data = await res.json();
        const base64Pcm = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Pcm) {
            console.error("No audio data returned from Gemini TTS:", JSON.stringify(data));
            return NextResponse.json({ error: "Gemini TTS returned no audio content" }, { status: 502 });
        }

        const pcmBuffer = Buffer.from(base64Pcm, "base64");
        const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
        const audioUrl = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;

        console.log(`Gemini TTS speech generated successfully (${wavBuffer.length} bytes WAV)`);
        return NextResponse.json({
            audioUrl,
            provider: "gemini_tts",
            format: "wav",
            durationHint: Math.round(pcmBuffer.length / (24000 * 2)),
        });

    } catch (error: any) {
        console.error("Audio Generation Error:", error?.message || error);
        return NextResponse.json({ error: error?.message || "Failed to synthesize audio" }, { status: 500 });
    }
}
