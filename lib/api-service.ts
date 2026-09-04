export interface VideoGenerationStatus {
    step: 'summarizing' | 'audio' | 'video' | 'complete' | 'error';
    progress: number;
    data?: any;
    error?: string;
}

export interface GenerateVideoOutput {
    videoUrl: string;
    driveUrl?: string | null;
    summary?: string;
    provider?: string;
}

export const ApiService = {
    async generateFullVideo(
        text: string,
        userImageUrl: string | null,
        userAudioUrl: string | null, // Optional user-recorded or uploaded audio Data URL
        onProgress: (status: VideoGenerationStatus) => void
    ): Promise<GenerateVideoOutput | null> {
        try {
            // Step 1: Summary & Guardrails (Gemini 3.6 Flash)
            onProgress({ step: 'summarizing', progress: 15 });
            const summaryRes = await fetch('/api/generate/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!summaryRes.ok) {
                const err = await summaryRes.json().catch(() => ({ error: 'Unknown error' }));
                const errorObj: any = new Error(err.error || `Summary API failed: ${summaryRes.statusText}`);
                errorObj.safetyViolation = err.safetyViolation;
                errorObj.category = err.category;
                throw errorObj;
            }

            const { summary } = await summaryRes.json();
            console.log("Summary generated successfully:", summary);
            onProgress({ step: 'summarizing', progress: 40, data: { summary } });

            // Step 2: Audio Synthesis (User's Voice OR Gemini 2.5 Flash TTS)
            onProgress({ step: 'audio', progress: 55 });
            let audioUrl: string;

            if (userAudioUrl && userAudioUrl.startsWith("data:audio/")) {
                console.log("Using user's uploaded/recorded voice track directly.");
                audioUrl = userAudioUrl;
            } else {
                console.log("Synthesizing speech with Gemini 2.5 Flash TTS...");
                const audioRes = await fetch('/api/generate/audio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: summary })
                });

                if (!audioRes.ok) {
                    const err = await audioRes.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(err.error || `Audio API failed: ${audioRes.statusText}`);
                }

                const audioData = await audioRes.json();
                audioUrl = audioData.audioUrl;
            }

            onProgress({ step: 'audio', progress: 75 });

            // Step 3: Video Assembly & Google Drive Archiving
            onProgress({ step: 'video', progress: 85 });
            const videoRes = await fetch('/api/generate/video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioUrl,
                    imageUrl: userImageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&auto=format&fit=crop&q=60"
                })
            });

            if (!videoRes.ok) {
                const err = await videoRes.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(err.error || `Video API failed: ${videoRes.statusText}`);
            }

            const videoData = await videoRes.json();
            console.log("Video API Response:", videoData);

            const output: GenerateVideoOutput = {
                videoUrl: videoData.video_url || audioUrl,
                driveUrl: videoData.drive_url || null,
                summary,
                provider: "remotion",
            };

            onProgress({ step: 'complete', progress: 100, data: output });
            return output;

        } catch (e: any) {
            console.warn("Video Generation Pipeline Error:", e?.message || e);
            onProgress({
                step: 'error',
                progress: 0,
                error: e?.message || "Generation failed",
                data: {
                    safetyViolation: e?.safetyViolation,
                    category: e?.category,
                }
            });
            return null;
        }
    }
};
