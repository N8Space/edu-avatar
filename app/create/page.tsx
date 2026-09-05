"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Loader2,
    Play,
    CheckCircle2,
    Mic,
    Video,
    Square,
    Sparkles,
    ShieldAlert,
    HardDrive,
    ExternalLink,
    Download,
    Key,
    Volume2,
    AlertCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PlayerComponent } from "@/components/remotion/PlayerComponent";

export default function CreatePage() {
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [driveUrl, setDriveUrl] = useState<string | null>(null);
    const [driveNotice, setDriveNotice] = useState<string | null>(null);
    const [localDownloadUrl, setLocalDownloadUrl] = useState<string | null>(null);
    const [generatedSummary, setGeneratedSummary] = useState<string>("");
    const [voiceMatchInfo, setVoiceMatchInfo] = useState<string | null>(null);
    const [safetyAlert, setSafetyAlert] = useState<{ reason: string; category?: string } | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [step, setStep] = useState(0);
    const [progress, setProgress] = useState(0);

    // HeyGen API Key state (Requirement 1: natural speaking avatar video generation)
    const [heygenKey, setHeygenKey] = useState("");
    const [showHeygenInput, setShowHeygenInput] = useState(false);

    // ElevenLabs API Key state (voice cloning)
    const [elevenlabsKey, setElevenlabsKey] = useState("");
    const [showElevenLabsInput, setShowElevenLabsInput] = useState(false);

    // Google OAuth Status state
    const [oauthConfig, setOauthConfig] = useState<{
        oauthConfigured: boolean;
        oauthConnected: boolean;
    } | null>(null);

    // User Voice State (Voice Sample for cloning / voice matching)
    const [isRecording, setIsRecording] = useState(false);
    const [timer, setTimer] = useState(0);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [audioSourceLabel, setAudioSourceLabel] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Fetch Google OAuth status for Drive storage
        fetch("/api/auth/google/status")
            .then(res => res.json())
            .then(data => setOauthConfig(data))
            .catch(() => {});
    }, []);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setRecordedAudioUrl(reader.result as string);
                setAudioSourceLabel(`Uploaded sample: ${file.name}`);
            };
            reader.readAsDataURL(file);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                const reader = new FileReader();
                reader.onloadend = () => {
                    setRecordedAudioUrl(reader.result as string);
                    setAudioSourceLabel(`Recorded Voice Sample (${timer}s)`);
                };
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setTimer(0);
            timerRef.current = setInterval(() => {
                setTimer(t => t + 1);
            }, 1000);

        } catch (e) {
            console.error("Mic Access Error:", e);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    // Full calibration passage for voice recording (Requirement 3: entire block displayed without truncation)
    const readingScript = "When the sunlight strikes raindrops in the air, they act as a prism and form a rainbow. The rainbow is a division of white light into many beautiful colors. These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon. There is, according to legend, a boiling pot of gold at one end. People look, but no one ever finds it. When a man looks for something beyond his reach, his friends say he is looking for the pot of gold at the end of the rainbow.";

    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const isOverWordLimit = wordCount > 500;

    const handleGenerate = async () => {
        if (isOverWordLimit) {
            setSafetyAlert({
                reason: `Content exceeds 500-word limit (${wordCount} words provided). Please shorten to under 500 words.`,
                category: "length_exceeded",
            });
            return;
        }

        setSafetyAlert(null);
        setDriveNotice(null);
        setLoading(true);
        setStep(1);

        try {
            const { ApiService } = await import("@/lib/api-service");
            const result = await ApiService.generateFullVideo(
                content,
                selectedImage,
                recordedAudioUrl,
                elevenlabsKey || null,
                heygenKey || null,
                (status) => {
                    setProgress(status.progress);
                    if (status.step === 'error') {
                        setLoading(false);
                        setStep(0);
                        if (status.data?.safetyViolation) {
                            setSafetyAlert({
                                reason: status.error || "Content safety boundary triggered.",
                                category: status.data?.category,
                            });
                        } else {
                            alert("Generation Error:\n\n" + status.error);
                        }
                    }
                }
            );

            if (result && result.videoUrl) {
                setVideoUrl(result.videoUrl);
                if (result.localDownloadUrl) setLocalDownloadUrl(result.localDownloadUrl);
                if (result.driveUrl) setDriveUrl(result.driveUrl);
                if (result.driveNotice) setDriveNotice(result.driveNotice);
                if (result.summary) setGeneratedSummary(result.summary);
                if (result.voiceMatchDescription) setVoiceMatchInfo(result.voiceMatchDescription);

                setLoading(false);
                setStep(2);
            } else {
                setLoading(false);
                setStep(0);
            }
        } catch (e: unknown) {
            const err = e as Error;
            console.warn("Generate Error:", err?.message || e);
            setLoading(false);
            setStep(0);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center p-4 bg-background">
            <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] opacity-50"></div>

            <div className="w-full max-w-4xl space-y-6 mt-6">
                {/* Header Navigation Link */}
                <div className="w-full flex items-center justify-between pb-2 border-b border-white/10 text-xs">
                    <a
                        href="https://winelogbooks.com/projects"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium"
                    >
                        <span>← Nathan Lester | AI Enablement Showcase</span>
                    </a>
                    <div className="flex items-center gap-2">
                        {oauthConfig?.oauthConnected ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Drive OAuth Connected
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                                Hostinger + Google Cloud
                            </span>
                        )}
                    </div>
                </div>

                <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                    Edu-Avatar Creator
                </h1>
                <p className="text-center text-sm text-muted-foreground max-w-lg mx-auto">
                    Transform any educational topic (≤ 500 words) into a speaking avatar video in under 30 seconds.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle>Content Input</CardTitle>
                                <CardDescription>Provide your avatar photo, voice sample, and educational topic.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Step 1: Avatar Image & HeyGen Configuration */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="image">1. Your Photo (Speaking Avatar)</Label>
                                        <button
                                            type="button"
                                            onClick={() => setShowHeygenInput(!showHeygenInput)}
                                            className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                            <Video className="w-3 h-3" />
                                            {showHeygenInput ? "Hide HeyGen Key" : "HeyGen Key (Photorealistic Video)"}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100">
                                            {selectedImage ? (
                                                <img src={selectedImage} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    <Video className="w-6 h-6" />
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            id="image"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                                        />
                                    </div>

                                    {/* HeyGen API Key Input (Requirement 1) */}
                                    {showHeygenInput && (
                                        <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-950/20 space-y-1.5 animate-in fade-in">
                                            <Label className="text-xs text-blue-200 font-semibold flex items-center gap-1.5">
                                                <Video className="w-3.5 h-3.5 text-blue-400" />
                                                HeyGen API Key (Photorealistic Speaking Video)
                                            </Label>
                                            <Input
                                                type="password"
                                                placeholder="Enter HeyGen API Key..."
                                                value={heygenKey}
                                                onChange={(e) => setHeygenKey(e.target.value.trim())}
                                                className="text-xs h-8 bg-black/40 border-blue-500/40 font-mono"
                                            />
                                            <p className="text-[10px] text-blue-300/70 leading-relaxed">
                                                When provided, HeyGen animates your avatar photo naturally speaking the audio in high-definition video. If omitted, the Remotion animated engine renders the video ($0.00).
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Voice Track Strategy */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-blue-100">2. Voice Sample & Synthesis Strategy</Label>
                                        <button
                                            type="button"
                                            onClick={() => setShowElevenLabsInput(!showElevenLabsInput)}
                                            className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                        >
                                            <Key className="w-3 h-3" />
                                            {showElevenLabsInput ? "Hide ElevenLabs" : "ElevenLabs Key"}
                                        </button>
                                    </div>

                                    {/* ElevenLabs API Key Input */}
                                    {showElevenLabsInput && (
                                        <div className="p-2.5 rounded-lg border border-purple-500/30 bg-purple-950/20 space-y-1.5 animate-in fade-in">
                                            <Label className="text-xs text-purple-200 font-semibold flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                                Option 1: ElevenLabs API Key (Instant Voice Cloning)
                                            </Label>
                                            <Input
                                                type="password"
                                                placeholder="Enter ElevenLabs Secret Key (starts with sk_)..."
                                                value={elevenlabsKey}
                                                onChange={(e) => setElevenlabsKey(e.target.value.trim())}
                                                className="text-xs h-8 bg-black/40 border-purple-500/40 font-mono"
                                            />
                                            {elevenlabsKey && !elevenlabsKey.startsWith("sk_") && (
                                                <div className="p-2 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-200 leading-snug space-y-1">
                                                    <p className="font-semibold text-amber-300">⚠️ Key ID Detected instead of Secret Key</p>
                                                    <p>
                                                        ElevenLabs API secret keys start with <code className="text-amber-100 bg-amber-950/50 px-1 py-0.5 rounded font-mono">sk_</code>.
                                                        You pasted the <em>Key ID</em>.
                                                    </p>
                                                    <p className="text-[10px] text-amber-300/80">
                                                        Go to <a href="https://elevenlabs.io/app/developers/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-white">elevenlabs.io/app/developers/api-keys</a>, click <strong>Create New Key</strong> (or the eye icon), and copy the key starting with <strong>sk_</strong>.
                                                    </p>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-purple-300/70 leading-relaxed">
                                                Included with your Starter Subscription. If omitted, Option 2 (Gemini Zero-SaaS Voice Match) synthesizes the script at $0.00.
                                            </p>
                                        </div>
                                    )}

                                    <div className="p-4 border border-white/10 rounded-lg bg-black/20 flex flex-col gap-4">
                                        {recordedAudioUrl ? (
                                            <div className="flex items-center justify-between text-green-400 gap-2 neon-text p-2 rounded bg-green-950/20 border border-green-500/30">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                                                    <div>
                                                        <p className="text-sm font-bold">Voice Sample Loaded</p>
                                                        <p className="text-xs text-green-300/70">{audioSourceLabel}</p>
                                                        <p className="text-[10px] text-cyan-300 mt-0.5">
                                                            {elevenlabsKey ? "Will clone voice via ElevenLabs" : "Will match voice via Gemini TTS"} to read 30s script
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setRecordedAudioUrl(null);
                                                        setAudioSourceLabel(null);
                                                    }}
                                                    className="text-xs text-gray-400 hover:text-white"
                                                >
                                                    Clear Sample
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Option A: File Upload */}
                                                <div className="space-y-2 pb-3 border-b border-white/10">
                                                    <Label className="text-xs text-blue-300/70 uppercase tracking-wider font-semibold">
                                                        A. Upload Voice Sample File
                                                    </Label>
                                                    <input
                                                        type="file"
                                                        accept="audio/*"
                                                        onChange={handleAudioFileUpload}
                                                        className="block w-full text-sm text-blue-200
                                                        file:mr-4 file:py-2 file:px-4
                                                        file:rounded-full file:border-0
                                                        file:text-xs file:font-semibold
                                                        file:bg-purple-900/40 file:text-purple-300
                                                        hover:file:bg-purple-800/50 cursor-pointer"
                                                    />
                                                </div>

                                                {/* Option B: Record (Requirement 3: displays entire block of text) */}
                                                <div className="space-y-2 pt-1">
                                                    <Label className="text-xs text-blue-300/70 uppercase tracking-wider font-semibold">
                                                        B. Record Voice Sample
                                                    </Label>
                                                    <div className="bg-black/35 p-3 rounded-lg border border-white/15 text-xs text-blue-100/90 leading-relaxed italic space-y-1">
                                                        <p className="font-semibold text-cyan-400 not-italic text-xs">
                                                            Suggested calibration script (read to calibrate your vocal characteristics):
                                                        </p>
                                                        <p className="text-[11px] leading-relaxed">
                                                            "{readingScript}"
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-col gap-2 pt-1">
                                                        {isRecording && (
                                                            <div className={`text-center font-mono font-bold text-lg ${timer < 10 ? 'text-orange-400' : 'text-green-400'}`}>
                                                                {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                                                                <span className="text-xs font-sans font-normal text-gray-400 block">
                                                                    Recording voice sample...
                                                                </span>
                                                            </div>
                                                        )}

                                                        <Button
                                                            variant={isRecording ? "destructive" : "secondary"}
                                                            size="sm"
                                                            type="button"
                                                            onClick={isRecording ? stopRecording : startRecording}
                                                            className="w-full"
                                                        >
                                                            {isRecording ? (
                                                                <> <Square className="w-4 h-4 mr-2" /> Stop Recording </>
                                                            ) : (
                                                                <> <Mic className="w-4 h-4 mr-2" /> Record Voice Sample </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="pt-2 border-t border-white/10 text-[11px] text-muted-foreground flex items-center gap-1.5">
                                                    <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                    <span>The 30-second script will be synthesized in your voice characteristics.</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Step 3: Text Content */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="content">3. Educational Topic / Text</Label>
                                        <span className={`text-xs font-mono ${isOverWordLimit ? "text-red-400 font-semibold" : "text-muted-foreground"}`}>
                                            {wordCount} / 500 words
                                        </span>
                                    </div>

                                    {/* Content Safety Warning Banner */}
                                    {safetyAlert && (
                                        <div className="p-3.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 text-xs flex flex-col gap-2 animate-in fade-in duration-300">
                                            <div className="flex items-start gap-2">
                                                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                <div className="space-y-1">
                                                    <p className="font-semibold text-red-300">
                                                        AI Safety Guardrail Triggered {safetyAlert.category ? `[${safetyAlert.category}]` : ""}
                                                    </p>
                                                    <p className="text-red-200/90 leading-relaxed">{safetyAlert.reason}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-1 border-t border-red-500/20">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    type="button"
                                                    className="h-6 text-xs text-red-300 hover:text-white"
                                                    onClick={() => setSafetyAlert(null)}
                                                >
                                                    Dismiss
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    <Textarea
                                        id="content"
                                        placeholder="Paste article or educational concept here (max 500 words)..."
                                        className={`min-h-[140px] ${isOverWordLimit ? "border-red-500/60 focus-visible:ring-red-500" : ""}`}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                    />
                                </div>

                                <Button
                                    onClick={handleGenerate}
                                    disabled={loading || step === 2 || !content || isOverWordLimit}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Video & Synthesizing Voice...
                                        </>
                                    ) : (
                                        <> <Sparkles className="mr-2 h-4 w-4" /> Generate Speaking Avatar Video </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        {step >= 1 && (
                            <Card className="bg-muted/50">
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span>Pipeline Progress</span>
                                        <span className="font-mono">{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="w-full h-2" />

                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            {progress >= 30 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                                            Guardrail check & Gemini 3.6 Flash summarization (~75 words)...
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {progress >= 70 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : (progress >= 30 && <Loader2 className="h-4 w-4 animate-spin" />)}
                                            Voice synthesis: Reading 30s script in your voice profile...
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {progress >= 100 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : (progress >= 70 && <Loader2 className="h-4 w-4 animate-spin" />)}
                                            Video generation ({heygenKey ? "HeyGen photorealistic talking video" : "Remotion dynamic player"}) & storage...
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="relative space-y-4">
                        {/* Preview Area (Requirement 2: clean player without captions over the avatar) */}
                        {step === 2 && videoUrl ? (
                            <div className="space-y-4">
                                <Card className="overflow-hidden shadow-2xl border-0">
                                    <CardContent className="p-0">
                                        <PlayerComponent
                                            videoUrl={videoUrl}
                                            imageUrl={selectedImage}
                                        />
                                    </CardContent>
                                </Card>

                                {/* Action Toolbar */}
                                <div className="p-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Video Ready</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs text-blue-400 hover:text-blue-300"
                                            onClick={() => {
                                                setStep(0);
                                                setVideoUrl("");
                                                setDriveUrl(null);
                                                setDriveNotice(null);
                                                setLocalDownloadUrl(null);
                                                setGeneratedSummary("");
                                            }}
                                        >
                                            Create Another
                                        </Button>
                                    </div>

                                    {/* Action Buttons: Direct Local Download & Google Drive */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                        {/* Direct Local Download Button */}
                                        <a
                                            href={localDownloadUrl || videoUrl}
                                            download={`edu_avatar_${Date.now()}.${videoUrl.includes("mp4") ? "mp4" : "wav"}`}
                                            className="inline-flex items-center justify-center gap-2 text-xs font-medium px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md"
                                        >
                                            <Download className="w-4 h-4" />
                                            <span>Download Video / Media File</span>
                                        </a>

                                        {/* Google Drive Status / Link */}
                                        {driveUrl ? (
                                            <a
                                                href={driveUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center gap-2 text-xs font-medium px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-md"
                                            >
                                                <HardDrive className="w-4 h-4" />
                                                <span>Open in Google Drive</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ) : (
                                            <div className="inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300">
                                                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                                                <span>Saved to Local Server</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Google Drive Warning / Troubleshooting Notice */}
                                    {driveNotice && (
                                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs space-y-1.5">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-semibold text-amber-300">Google Drive Archive Status</p>
                                                    <p className="text-amber-200/90 leading-relaxed text-[11px] mt-0.5">
                                                        {driveNotice}
                                                    </p>
                                                </div>
                                            </div>
                                            {oauthConfig?.oauthConfigured && !oauthConfig?.oauthConnected && (
                                                <div className="pt-1.5 border-t border-amber-500/20 flex justify-end">
                                                    <a
                                                        href="/api/auth/google"
                                                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
                                                    >
                                                        <span>Connect Google Account via OAuth</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 30-Second Script Display in info card */}
                                    {generatedSummary && (
                                        <div className="text-xs text-muted-foreground border-t border-white/10 pt-2 space-y-1">
                                            {voiceMatchInfo && (
                                                <div className="text-[11px] text-cyan-300 flex items-center gap-1.5">
                                                    <Sparkles className="w-3 h-3" />
                                                    <span>{voiceMatchInfo}</span>
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-semibold text-foreground">30-Second Script: </span>
                                                "{generatedSummary}"
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[400px] border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                <div className="p-4 rounded-full bg-gray-50 dark:bg-gray-900 mb-4">
                                    <Play className="w-8 h-8 opacity-50" />
                                </div>
                                <p className="font-medium">Video Preview</p>
                                <p className="text-sm mt-2">Your speaking avatar video will appear here once generated.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
