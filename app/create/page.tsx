"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Play, CheckCircle2, Mic, Video, Square, Sparkles, ShieldAlert, HardDrive, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PlayerComponent } from "@/components/remotion/PlayerComponent";

export default function CreatePage() {
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [driveUrl, setDriveUrl] = useState<string | null>(null);
    const [generatedSummary, setGeneratedSummary] = useState<string>("");
    const [safetyAlert, setSafetyAlert] = useState<{ reason: string; category?: string } | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [step, setStep] = useState(0);
    const [progress, setProgress] = useState(0);

    // User Voice State (Direct Recording / Upload or Gemini AI Voice)
    const [isRecording, setIsRecording] = useState(false);
    const [timer, setTimer] = useState(0);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [audioSourceLabel, setAudioSourceLabel] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

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
                setAudioSourceLabel(`Uploaded: ${file.name}`);
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
                    setAudioSourceLabel(`Recorded Voice (${timer}s)`);
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
        setLoading(true);
        setStep(1);

        try {
            const { ApiService } = await import("@/lib/api-service");
            const result = await ApiService.generateFullVideo(content, selectedImage, recordedAudioUrl, (status) => {
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
            });

            if (result && result.videoUrl) {
                setVideoUrl(result.videoUrl);
                if (result.driveUrl) setDriveUrl(result.driveUrl);
                if (result.summary) setGeneratedSummary(result.summary);
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
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                        Hostinger + Google Cloud (Zero SaaS)
                    </span>
                </div>

                <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                    Edu-Avatar Creator
                </h1>
                <p className="text-center text-sm text-muted-foreground max-w-lg mx-auto">
                    Transform any educational topic (≤ 500 words) into an animated talking-avatar video in under 30 seconds.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle>Content Input</CardTitle>
                                <CardDescription>Provide your avatar selfie, voice track, and educational topic.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Step 1: Avatar Image */}
                                <div className="space-y-2">
                                    <Label htmlFor="image">1. Your Selfie (Avatar)</Label>
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
                                </div>

                                {/* Step 2: Voice Track */}
                                <div className="space-y-2">
                                    <Label className="text-blue-100">2. Voice Track (Your Voice or Gemini AI)</Label>
                                    <div className="p-4 border border-white/10 rounded-lg bg-black/20 flex flex-col gap-4">
                                        {recordedAudioUrl ? (
                                            <div className="flex items-center justify-between text-green-400 gap-2 neon-text p-2 rounded bg-green-950/20 border border-green-500/30">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                                                    <div>
                                                        <p className="text-sm font-bold">Personal Voice Selected</p>
                                                        <p className="text-xs text-green-300/70">{audioSourceLabel}</p>
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
                                                    Use Gemini AI Voice
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Option A: File Upload */}
                                                <div className="space-y-2 pb-3 border-b border-white/10">
                                                    <Label className="text-xs text-blue-300/70 uppercase tracking-wider font-semibold">Option A: Upload Audio File</Label>
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

                                                {/* Option B: Record */}
                                                <div className="space-y-2 pt-1">
                                                    <Label className="text-xs text-blue-300/70 uppercase tracking-wider font-semibold">Option B: Record Your Voice</Label>
                                                    <div className="bg-black/30 p-3 rounded border border-white/10 text-xs text-blue-100/80 leading-relaxed italic">
                                                        <p className="font-semibold text-cyan-400 mb-1 not-italic">Suggested script or speak your topic:</p>
                                                        "{readingScript}"
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        {isRecording && (
                                                            <div className={`text-center font-mono font-bold text-lg ${timer < 10 ? 'text-orange-400' : 'text-green-400'}`}>
                                                                {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                                                                <span className="text-xs font-sans font-normal text-gray-400 block">
                                                                    Recording in progress...
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
                                                                <> <Mic className="w-4 h-4 mr-2" /> Start Recording </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="pt-2 border-t border-white/10 text-[11px] text-muted-foreground flex items-center gap-1.5">
                                                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                    <span>If no audio is provided, <strong>Google Gemini 2.5 Flash TTS</strong> will automatically synthesize speech ($0.00).</span>
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
                                        className={`min-h-[150px] ${isOverWordLimit ? "border-red-500/60 focus-visible:ring-red-500" : ""}`}
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
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                                        </>
                                    ) : (
                                        <> <Sparkles className="mr-2 h-4 w-4" /> Generate Video </>
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
                                            Guardrail check & Gemini 3.6 Flash summarization...
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {progress >= 70 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : (progress >= 30 && <Loader2 className="h-4 w-4 animate-spin" />)}
                                            Voice track ({recordedAudioUrl ? "Personal Audio" : "Gemini 2.5 Flash TTS"})...
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {progress >= 100 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : (progress >= 70 && <Loader2 className="h-4 w-4 animate-spin" />)}
                                            Remotion video rendering & Google Drive archive...
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="relative space-y-4">
                        {/* Preview Area */}
                        {step === 2 && videoUrl ? (
                            <div className="space-y-4">
                                <Card className="overflow-hidden shadow-2xl border-0">
                                    <CardContent className="p-0">
                                        <PlayerComponent
                                            videoUrl={videoUrl}
                                            captions={generatedSummary || content.substring(0, 100) + "..."}
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
                                                setGeneratedSummary("");
                                            }}
                                        >
                                            Create Another
                                        </Button>
                                    </div>

                                    {/* Google Drive Archive Button */}
                                    {driveUrl && (
                                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-blue-200">
                                                <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                                                <span>Archived to Google Drive</span>
                                            </div>
                                            <a
                                                href={driveUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                                            >
                                                <span>Open in Drive</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    )}

                                    {generatedSummary && (
                                        <div className="text-xs text-muted-foreground border-t border-white/10 pt-2">
                                            <span className="font-semibold text-foreground">30-Second Script: </span>
                                            "{generatedSummary}"
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
                                <p className="text-sm mt-2">Your synchronized talking avatar will appear here once generated.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
