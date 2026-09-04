import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, Mic, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground animate-in fade-in zoom-in duration-700 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-pulse delay-1000"></div>

      <main className="flex flex-col items-center gap-10 px-4 text-center max-w-5xl z-10">

        {/* Hero Header */}
        <div className="space-y-6 flex flex-col items-center relative z-20">
          <div className="flex items-center gap-2">
            <a
              href="https://winelogbooks.com/projects"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
            >
              ← Nathan Lester AI Enablement Portfolio
            </a>
          </div>

          <h1 className="text-5xl font-black tracking-tighter sm:text-7xl bg-gradient-to-br from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent neon-text leading-[1.1] py-4 px-2 relative z-30">
            Edu-Avatar
          </h1>

          <p className="text-lg text-blue-100/80 sm:text-xl max-w-[720px] mx-auto leading-relaxed">
            Turn any educational topic (≤ 500 words) into an interactive <span className="text-cyan-400 font-bold">30-second talking avatar video</span>.
            Engineered with multi-layer AI safety guardrails, free-tier voice synthesis, and direct Google Drive archiving.
          </p>

          <div className="mt-6 relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-40 group-hover:opacity-100 transition duration-500"></div>
            <Link href="/create">
              <Button size="lg" className="relative h-14 px-10 rounded-full text-lg font-bold bg-background border border-white/20 hover:bg-white/10 text-white shadow-2xl transition-all">
                <Sparkles className="w-5 h-5 mr-2 text-cyan-400 fill-cyan-400" />
                Launch Edu-Avatar Studio
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Grid (Glass Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-6 text-left">
          <div className="glass-card p-6 rounded-2xl flex flex-col items-start gap-3 hover:-translate-y-1 transition-transform duration-300">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary mb-1 neon-border">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Talking Avatars & Remotion</h3>
            <p className="text-xs text-blue-200/70 leading-relaxed">
              Upload your selfie to generate an animated video with synchronized captions rendered directly by the Remotion engine.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl flex flex-col items-start gap-3 hover:-translate-y-1 transition-transform duration-300 delay-100">
            <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary mb-1 neon-border">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Real Voice & Gemini TTS</h3>
            <p className="text-xs text-blue-200/70 leading-relaxed">
              Use your microphone to record your own voice, or let Google Gemini 2.5 Flash TTS synthesize natural educational narration for free.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl flex flex-col items-start gap-3 hover:-translate-y-1 transition-transform duration-300 delay-200">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1 neon-border">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">OWASP Guardrails & Audit</h3>
            <p className="text-xs text-blue-200/70 leading-relaxed">
              Multi-layer prompt injection defense, XML encapsulation, Google Drive archiving, and Hostinger n8n security telemetry.
            </p>
          </div>
        </div>

        <div className="text-xs text-blue-200/40 mt-8 font-mono uppercase tracking-wider flex items-center gap-3">
          <span>Hostinger VPS</span> • <span>Google Cloud & Gemini</span> • <span>n8n Orchestration</span> • <span>Google Drive</span>
        </div>
      </main>
    </div>
  );
}
