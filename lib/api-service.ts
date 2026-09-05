export interface VideoGenerationStatus {
    step: 'summarizing' | 'audio' | 'video' | 'complete' | 'error';
    progress: number;
    data?: any;
    error?: string;
}

export interface GenerateVideoOutput {
    videoUrl: string;
    audioUrl?: string;
    localDownloadUrl?: string | null;
    driveUrl?: string | null;
    driveNotice?: string | null;
    summary?: string;
    provider?: string;
    voiceMatchDescription?: string;
}

export const ApiService = {
    async generateFullVideo(
        text: string,
        userImageUrl: string | null,
        userAudioUrl: string | null, // Optional user-recorded voice sample for voice cloning/matching
        elevenlabsApiKey: string | null,
        heygenApiKey: string | null,
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
            onProgress({ step: 'summarizing', progress: 35, data: { summary } });

            // Step 2: Audio Synthesis for the 30-Second Script
            // Two-tier approach: ElevenLabs Voice Clone (Tier 1) -> Gemini Voice Match (Tier 2)
            onProgress({ step: 'audio', progress: 50 });

            console.log("Synthesizing 30-second script audio with voice characteristics...");
            const audioRes = await fetch('/api/generate/audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: summary,
                    voiceSampleUrl: userAudioUrl || undefined,
                    elevenlabsApiKey: elevenlabsApiKey || undefined,
                })
            });

            if (!audioRes.ok) {
                const err = await audioRes.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(err.error || `Audio API failed: ${audioRes.statusText}`);
            }

            const audioData = await audioRes.json();
            const audioUrl = audioData.audioUrl;
            console.log(`Speech synthesized via ${audioData.provider} (${audioData.voiceName || "cloned voice"})`);

            onProgress({
                step: 'audio',
                progress: 70,
                data: {
                    provider: audioData.provider,
                    voiceName: audioData.voiceName,
                    voiceMatchDescription: audioData.voiceMatchDescription
                }
            });

            // Step 3: Video Assembly & Storage Archiving (HeyGen or Remotion)
            onProgress({ step: 'video', progress: 80 });
            const videoRes = await fetch('/api/generate/video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioUrl,
                    imageUrl: userImageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&auto=format&fit=crop&q=60",
                    heygenApiKey: heygenApiKey || undefined,
                })
            });

            if (!videoRes.ok) {
                const err = await videoRes.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(err.error || `Video API failed: ${videoRes.statusText}`);
            }

            const videoData = await videoRes.json();
            console.log("Video API Response:", videoData);

            // Case A: Immediate Completed (Remotion Animated Player Mode)
            if (videoData.status === 'completed') {
                const output: GenerateVideoOutput = {
                    videoUrl: videoData.video_url || audioUrl,
                    audioUrl,
                    localDownloadUrl: videoData.local_download_url || null,
                    driveUrl: videoData.drive_url || null,
                    driveNotice: videoData.drive_notice || null,
                    summary,
                    provider: videoData.provider || audioData.provider,
                    voiceMatchDescription: audioData.voiceMatchDescription,
                };

                onProgress({ step: 'complete', progress: 100, data: output });
                return output;
            }

            // Case B: Asynchronous Processing (HeyGen Photorealistic Video Mode)
            const video_id = videoData.id;
            console.log("Polling HeyGen video generation status for job ID:", video_id);

            let attempts = 0;
            const maxAttempts = 120; // 5 minutes (120 * 2500ms)

            return new Promise((resolve, reject) => {
                const pollInterval = setInterval(async () => {
                    attempts++;
                    try {
                        const statusRes = await fetch('/api/generate/video/status', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                video_id,
                                heygenApiKey: heygenApiKey || undefined,
                            })
                        });

                        if (statusRes.ok) {
                            const statusData = await statusRes.json();
                            const currentStatus = statusData.status || statusData.data?.status;
                            const progressPercent = Math.min(98, 80 + Math.floor((attempts / maxAttempts) * 18));
                            onProgress({ step: 'video', progress: progressPercent });

                            if (currentStatus === 'completed') {
                                clearInterval(pollInterval);
                                const output: GenerateVideoOutput = {
                                    videoUrl: statusData.video_url || statusData.data?.video_url,
                                    audioUrl,
                                    localDownloadUrl: statusData.local_download_url || null,
                                    driveUrl: statusData.drive_url || null,
                                    summary,
                                    provider: "heygen",
                                    voiceMatchDescription: audioData.voiceMatchDescription,
                                };
                                console.log("HeyGen Video generation finished successfully:", output.videoUrl);
                                onProgress({ step: 'complete', progress: 100, data: output });
                                resolve(output);
                                return;
                            }

                            if (currentStatus === 'failed' || currentStatus === 'error') {
                                clearInterval(pollInterval);
                                const errorReason = statusData.error || statusData.data?.error || "HeyGen video generation failed";
                                reject(new Error(typeof errorReason === 'string' ? errorReason : JSON.stringify(errorReason)));
                                return;
                            }
                        }
                    } catch (pollErr) {
                        console.warn("Polling error (retrying):", pollErr);
                    }

                    if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        reject(new Error("Video generation timed out after 5 minutes"));
                    }
                }, 2500);
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
