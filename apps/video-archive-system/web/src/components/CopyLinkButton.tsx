import { useState } from "react";
import { useTrackEvent } from "../hooks/useTrackEvent";

export function CopyLinkButton({
  orgId,
  videoId,
  loomUrl,
}: {
  orgId: string | null;
  videoId: string;
  loomUrl: string;
}) {
  const trackEvent = useTrackEvent(orgId);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(loomUrl);
    // The click always copies and always shows feedback — the per-minute
    // dedupe in useTrackEvent only affects whether this particular click
    // increments the metric, not the user-facing action.
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    trackEvent(videoId, "copy_button");
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}
