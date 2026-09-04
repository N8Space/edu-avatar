export interface VideoGenerationStatus {
    step: 'summarizing' | 'audio' | 'video' | 'complete' | 'error';
    progress: number;
    data?: any;
    error?: string;
}

export interface CloneVoiceResult {
    voiceId: string | null;
    error?: string;
}

export interface GenerateVideoOutput {
    videoUrl: string;
    driveUrl?: string | null;
    summary?: string;
    provider?: string;
}

export const ApiService = {
    async cloneVoice(audioBlob: Blob): Promise<CloneVoiceResult> {
        try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");

            const res = await fetch("/api/clone-voice", {
                method: "POST",
                body: formData,
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                return {
                    voiceId: null,
                    error: data?.error || res.statusText || "Voice cloning failed",
                };
            }

            return { voiceId: data?.voice_id || null };
        } catch (e: any) {
            return {
                voiceId: null,
                error: e?.message || "Voice cloning request failed",
            };
        }
    },

    async generateFullVideo(
        text: string,
        userImageUrl: string | null,
        voiceId: string | null, // Optional custom cloned voice
        onProgress: (status: VideoGenerationStatus) => void
    ): Promise<GenerateVideoOutput | null> {
        try {
            // Step 1: Summary (Gemini 3.6 Flash + Guardrails)
            onProgress({ step: 'summarizing', progress: 10 });
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
            onProgress({ step: 'summarizing', progress: 30, data: { summary } });

            // Step 2: Audio Synthesis (ElevenLabs or Gemini TTS fallback)
            onProgress({ step: 'audio', progress: 40 });
            const audioRes = await fetch('/api/generate/audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: summary, voiceId: voiceId || undefined })
            });

            if (!audioRes.ok) {
                const err = await audioRes.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(err.error || `Audio API failed: ${audioRes.statusText}`);
            }

            const { audioUrl } = await audioRes.json();
            console.log("Audio generated successfully");
            onProgress({ step: 'audio', progress: 70 });

            // Step 3: Video Generation / Remotion Player Mode & Drive Archive
            onProgress({ step: 'video', progress: 80 });

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

            // Immediate completed mode (Remotion dynamic player mode or mock)
            if (videoData.status === 'completed' && videoData.video_url) {
                const output: GenerateVideoOutput = {
                    videoUrl: videoData.video_url,
                    driveUrl: videoData.drive_url || null,
                    summary,
                    provider: videoData.provider || "remotion",
                };
                onProgress({ step: 'complete', progress: 100, data: output });
                return output;
            }

            const video_id = videoData.id;
            console.log("Polling HeyGen video status for job:", video_id);

            // Poll for HeyGen completion
            let attempts = 0;
            const maxAttempts = 150; // 5 minutes (150 * 2000ms)

            return new Promise((resolve, reject) => {
                const pollInterval = setInterval(async () => {
                    attempts++;
                    try {
                        const statusRes = await fetch('/api/generate/video/status', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ video_id })
                        });

                        if (statusRes.ok) {
                            const statusData = await statusRes.json();
                            const status = statusData.data?.status || statusData.status;
                            const url = statusData.data?.video_url || statusData.video_url;

                            if (status === 'completed') {
                                clearInterval(pollInterval);
                                const output: GenerateVideoOutput = {
                                    videoUrl: url,
                                    driveUrl: statusData.data?.drive_url || statusData.drive_url || null,
                                    summary,
                                    provider: "heygen",
                                };
                                onProgress({ step: 'complete', progress: 100, data: output });
                                resolve(output);
                            } else if (status === 'failed' || status === 'error') {
                                clearInterval(pollInterval);
                                const errorReason = statusData.data?.error || statusData.error || 'Video generation failed at provider';
                                throw new Error(typeof errorReason === 'string' ? errorReason : JSON.stringify(errorReason));
                            }
                        }
                    } catch (e) {
                        console.error("Polling error:", e);
                    }

                    if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        reject(new Error("Video generation timed out"));
                    }
                }, 2000);
            });

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
