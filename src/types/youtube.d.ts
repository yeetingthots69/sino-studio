/**
 * Minimal ambient type declarations for the YouTube IFrame Player API.
 * Loaded globally via <Script src="https://www.youtube.com/iframe_api" />.
 * Full typings: @types/youtube (not installed to keep deps lean).
 */

interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
}

declare namespace YT {
    enum PlayerState {
        UNSTARTED = -1,
        ENDED     =  0,
        PLAYING   =  1,
        PAUSED    =  2,
        BUFFERING =  3,
        CUED      =  5,
    }

    interface PlayerOptions {
        videoId?: string;
        width?: number | string;
        height?: number | string;
        playerVars?: {
            rel?: 0 | 1;
            modestbranding?: 0 | 1;
            autoplay?: 0 | 1;
            controls?: 0 | 1;
            [key: string]: unknown;
        };
        events?: {
            onReady?: (event: { target: Player }) => void;
            onStateChange?: (event: { data: PlayerState }) => void;
            onError?: (event: { data: number }) => void;
        };
    }

    class Player {
        constructor(elementOrId: HTMLElement | string, options: PlayerOptions);
        getCurrentTime(): number;
        getDuration(): number;
        getPlayerState(): PlayerState;
        seekTo(seconds: number, allowSeekAhead: boolean): void;
        playVideo(): void;
        pauseVideo(): void;
        destroy(): void;
    }
}

