import React from 'react';
import { AbsoluteFill, useCurrentFrame, Video, Img, Audio, interpolate } from 'remotion';

// Helper to proxy URLs to avoid CORS/CORB issues in the browser
const proxyUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith('data:')) return url;
    if (url.startsWith('/api/proxy')) return url;
    if (url.startsWith('/generated/')) return url;
    return `/api/proxy/audio?url=${encodeURIComponent(url)}`;
};

export interface MyCompositionProps {
    videoUrl: string;
    captions?: string;
    imageUrl?: string;
}

export const MyComposition: React.FC<MyCompositionProps> = ({
    videoUrl,
    imageUrl,
}) => {
    const frame = useCurrentFrame();

    // Check if the source is an MP4 video (e.g. from HeyGen) or an audio track
    const isVideo = videoUrl?.includes('.mp4');
    const mediaSrc = isVideo ? videoUrl : proxyUrl(videoUrl);

    // -------------------------------------------------------------------------
    // Audio-Reactive Talking Avatar Animation Engine (Used when audio-only)
    // -------------------------------------------------------------------------
    const isPause = (frame % 55) > 46;
    const rawSyllable = Math.sin((frame * Math.PI) / 4.5) * 0.6 + Math.sin((frame * Math.PI) / 2.8) * 0.4;
    const speechOpenness = isPause ? 0 : Math.max(0, rawSyllable);
    const jawDrop = speechOpenness * 14;

    const breathScale = 1 + Math.sin(frame * 0.05) * 0.008;
    const speechNod = isPause ? 0 : Math.sin((frame * Math.PI) / 6) * 3;
    const headTilt = Math.sin(frame * 0.04) * 1.2;
    const headY = Math.sin(frame * 0.08) * 2 + speechNod;

    const pulse1 = (frame * 1.5) % 40;
    const pulse1Scale = 1 + pulse1 / 70;
    const pulse1Opacity = interpolate(pulse1, [0, 20, 40], [0.6, 0.3, 0], { extrapolateRight: 'clamp' });

    const pulse2 = ((frame * 1.5) + 20) % 40;
    const pulse2Scale = 1 + pulse2 / 70;
    const pulse2Opacity = interpolate(pulse2, [0, 20, 40], [0.5, 0.2, 0], { extrapolateRight: 'clamp' });

    const avatarImage = imageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&auto=format&fit=crop&q=60";

    // -------------------------------------------------------------------------
    // Mode A: Photorealistic Full-Frame Video (HeyGen MP4)
    // -------------------------------------------------------------------------
    if (isVideo) {
        return (
            <AbsoluteFill style={{ backgroundColor: '#000000' }}>
                <Video
                    {...({
                        src: mediaSrc,
                        style: {
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        }
                    } as any)}
                />
            </AbsoluteFill>
        );
    }

    // -------------------------------------------------------------------------
    // Mode B: Audio-Reactive Talking Avatar (Zero-SaaS Remotion Engine)
    // -------------------------------------------------------------------------
    return (
        <AbsoluteFill style={{ backgroundColor: '#020617', overflow: 'hidden' }}>
            {/* Background Layer: Deep Studio Indigo/Slate Gradient */}
            <AbsoluteFill
                style={{
                    background: 'radial-gradient(ellipse at 50% 30%, #1e1b4b 0%, #0f172a 50%, #020617 100%)',
                    zIndex: 0
                }}
            />

            {/* Subtle Tech Grid Texture */}
            <AbsoluteFill
                style={{
                    backgroundImage: 'radial-gradient(rgba(99, 102, 241, 0.15) 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                    opacity: 0.4,
                    zIndex: 1
                }}
            />

            {/* Glowing Accent Orbs */}
            <div style={{
                position: 'absolute',
                top: 140,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 500,
                height: 500,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, rgba(147, 51, 234, 0.08) 60%, transparent 80%)',
                filter: 'blur(40px)',
                zIndex: 1
            }} />

            {/* Centered Talking Avatar Portrait */}
            <AbsoluteFill style={{
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 2
            }}>
                <div style={{
                    position: 'relative',
                    width: 380,
                    height: 380,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `translateY(${headY}px) rotate(${headTilt}deg) scale(${breathScale})`,
                    transition: 'transform 0.05s ease-out'
                }}>
                    {/* Audio Reactive Speech Wave Rings */}
                    {speechOpenness > 0.05 && (
                        <>
                            <div style={{
                                position: 'absolute',
                                width: 380,
                                height: 380,
                                borderRadius: '50%',
                                border: '2px solid rgba(56, 189, 248, 0.8)',
                                transform: `scale(${pulse1Scale})`,
                                opacity: pulse1Opacity,
                                pointerEvents: 'none'
                            }} />
                            <div style={{
                                position: 'absolute',
                                width: 380,
                                height: 380,
                                borderRadius: '50%',
                                border: '2px solid rgba(168, 85, 247, 0.8)',
                                transform: `scale(${pulse2Scale})`,
                                opacity: pulse2Opacity,
                                pointerEvents: 'none'
                            }} />
                        </>
                    )}

                    {/* Main Avatar Container */}
                    <div style={{
                        width: 360,
                        height: 360,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '4px solid rgba(255, 255, 255, 0.3)',
                        boxShadow: speechOpenness > 0.1
                            ? '0 0 45px rgba(56, 189, 248, 0.45), 0 20px 50px rgba(0, 0, 0, 0.7)'
                            : '0 0 25px rgba(99, 102, 241, 0.25), 0 20px 50px rgba(0, 0, 0, 0.7)',
                        position: 'relative',
                        backgroundColor: '#1e293b',
                    }}>
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            {/* Upper Face Layer (Eyes, Forehead, Hair: 0% to 68% height) */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '68%',
                                overflow: 'hidden',
                                zIndex: 2,
                            }}>
                                <Img
                                    {...({
                                        src: avatarImage,
                                        style: {
                                            width: 360,
                                            height: 360,
                                            objectFit: 'cover',
                                            display: 'block'
                                        }
                                    } as any)}
                                />
                            </div>

                            {/* Inner Mouth Cavity (Revealed when jaw opens during speech) */}
                            <div style={{
                                position: 'absolute',
                                top: '64%',
                                left: '38%',
                                width: '24%',
                                height: `${Math.max(2, jawDrop + 2)}px`,
                                backgroundColor: '#2d0a0a',
                                borderRadius: '50%',
                                zIndex: 1,
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                overflow: 'hidden',
                            }}>
                                {/* Upper Teeth highlight */}
                                <div style={{
                                    width: '70%',
                                    height: '3px',
                                    backgroundColor: '#ffffff',
                                    borderRadius: '1px',
                                    opacity: 0.9,
                                }} />
                                {/* Tongue contour */}
                                {jawDrop > 5 && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        width: '60%',
                                        height: '4px',
                                        backgroundColor: '#b91c1c',
                                        borderRadius: '50% 50% 0 0',
                                    }} />
                                )}
                            </div>

                            {/* Lower Jaw & Chin Layer (Moves dynamically with speech rhythm) */}
                            <div style={{
                                position: 'absolute',
                                top: '66%',
                                left: 0,
                                width: '100%',
                                height: '34%',
                                overflow: 'hidden',
                                transform: `translateY(${jawDrop}px)`,
                                transformOrigin: 'top center',
                                zIndex: 3,
                                transition: 'transform 0.04s ease-out'
                            }}>
                                <Img
                                    {...({
                                        src: avatarImage,
                                        style: {
                                            width: 360,
                                            height: 360,
                                            marginTop: -237, // Matches 66% of 360px
                                            objectFit: 'cover',
                                            display: 'block'
                                        }
                                    } as any)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Active Voice Badge */}
                    <div style={{
                        position: 'absolute',
                        bottom: -16,
                        backgroundColor: speechOpenness > 0.05 ? '#0284c7' : '#334155',
                        color: '#ffffff',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        padding: '3px 14px',
                        borderRadius: 12,
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        zIndex: 10
                    }}>
                        <span style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: speechOpenness > 0.05 ? '#38bdf8' : '#94a3b8',
                            boxShadow: speechOpenness > 0.05 ? '0 0 8px #38bdf8' : 'none'
                        }} />
                        {speechOpenness > 0.05 ? 'Speaking' : 'Listening'}
                    </div>
                </div>
            </AbsoluteFill>

            {/* Audio Track */}
            {mediaSrc && <Audio {...({ src: mediaSrc } as any)} />}
        </AbsoluteFill>
    );
};
