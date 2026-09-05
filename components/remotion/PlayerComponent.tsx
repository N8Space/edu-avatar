"use client";

import { Player } from "@remotion/player";
import { MyComposition } from "./MyComposition";

export const PlayerComponent = ({
    videoUrl,
    captions,
    imageUrl,
}: {
    videoUrl: string;
    captions?: string;
    imageUrl?: string | null;
}) => {
    return (
        <Player
            component={MyComposition}
            inputProps={{
                videoUrl,
                captions,
                imageUrl: imageUrl || undefined,
            }}
            durationInFrames={30 * 30} // 30 seconds
            compositionWidth={1280}
            compositionHeight={720}
            fps={30}
            style={{
                width: '100%',
                aspectRatio: '16/9',
            }}
            controls
        />
    );
};
