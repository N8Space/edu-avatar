import { AbsoluteFill, useVideoConfig, Video, Img, Audio } from 'remotion';

// Helper to proxy the Google Drive URL to avoid CORS/CORB issues in the browser
const proxyUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith('data:')) return url;
    if (url.startsWith('/api/proxy')) return url;
    // We encode the component to be safe, though Google Drive URLs are usually simple
    return `/api/proxy/audio?url=${encodeURIComponent(url)}`;
};

export const MyComposition = ({
    videoUrl,
    captions,
    imageUrl
}: {
    videoUrl: string;
    captions?: string;
    imageUrl?: string;
}) => {
    const { fps, durationInFrames, width, height } = useVideoConfig();

    // Check if the source is an MP4 video or an audio track
    const isVideo = videoUrl?.includes('.mp4');
    const mediaSrc = isVideo ? videoUrl : proxyUrl(videoUrl);

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {/* Background Layer: Dynamic Gradient */}
            <AbsoluteFill
                style={{
                    background: 'linear-gradient(to bottom right, #1e293b, #0f172a, #020617)',
                    zIndex: 0
                }}
            />

            {/* Decoration: Grid */}
            <AbsoluteFill style={{
                backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                opacity: 0.2,
                zIndex: 1
            }} />

            {/* Avatar Layer */}
            <AbsoluteFill style={{
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 2
            }}>
                <div style={{
                    width: 400,
                    height: 400,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '4px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    position: 'relative'
                }}>
                    {isVideo ? (
                        <Video
                            {...({
                                src: mediaSrc,
                                style: { width: '100%', height: '100%', objectFit: 'cover' }
                            } as any)}
                        />
                    ) : (
                        <Img
                            {...({
                                src: imageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&auto=format&fit=crop&q=60",
                                style: { width: '100%', height: '100%', objectFit: 'cover' }
                            } as any)}
                        />
                    )}
                </div>
            </AbsoluteFill>

            {/* Audio Layer: Only if NOT rendering Video (to avoid double audio) */}
            {mediaSrc && !isVideo && <Audio {...({ src: mediaSrc } as any)} />}



            {/* Text Overlay Layer */}
            <AbsoluteFill style={{
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: 80,
                zIndex: 3
            }}>
                <div style={{
                    background: 'rgba(0,0,0,0.6)',
                    padding: '20px 40px',
                    borderRadius: 16,
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    maxWidth: '80%',
                    textAlign: 'center'
                }}>
                    <h2 style={{
                        color: 'white',
                        fontFamily: 'sans-serif',
                        fontSize: 24,
                        margin: 0
                    }}>{captions || "Your educational content will appear here..."}</h2>
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
