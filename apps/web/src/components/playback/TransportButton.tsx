import { useMessages } from "@/lib/i18n";
import { UnfocusableButton } from "./UnfocusableButton";

interface Props {
  playing: boolean;
  onToggle: () => void;
}

function TransportIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {playing ? (
        <>
          <path
            d="M5.5 4v8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M10.5 4v8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path d="M6 4.5 12 8 6 11.5V4.5z" fill="currentColor" />
      )}
    </svg>
  );
}

/** Play / pause — triangle and twin bars, same vocabulary as the round-autoplay icon. */
export function TransportButton({ playing, onToggle }: Props) {
  const { messages } = useMessages();
  const label = playing ? messages.playback.pause : messages.playback.play;
  return (
    <UnfocusableButton
      className="icon-btn transport-btn"
      ariaLabel={label}
      title={label}
      onClick={onToggle}
    >
      <TransportIcon playing={playing} />
    </UnfocusableButton>
  );
}
