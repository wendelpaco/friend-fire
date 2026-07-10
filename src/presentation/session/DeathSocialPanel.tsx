"use client";

import type { ChatChannel, ChatEntry } from "@/game/types";
import { Panel } from "@/presentation/ui/Panel";
import { SquadChat } from "@/presentation/session/SquadChat";

type DeathSocialPanelProps = {
 spectateTargetName: string;
 cameraMode: "locked" | "free";
 messages: ChatEntry[];
 onSendChat: (channel: ChatChannel, text: string) => void;
 onChatFocusChange?: (focused: boolean) => void;
};

/**
 * Full death social overlay while spectating in live (Meta-3).
 * Replaces thin "ESPECTANDO" banner; keeps player in room.
 */
export function DeathSocialPanel({
 spectateTargetName,
 cameraMode,
 messages,
 onSendChat,
 onChatFocusChange,
}: DeathSocialPanelProps) {
 const following = cameraMode === "locked" && spectateTargetName.length > 0;

 return (
  <div className="pointer-events-none absolute inset-0 z-25">
   {/* Top death / spectate chrome */}
   <div className="absolute left-1/2 top-[14%] z-20 -translate-x-1/2">
    <Panel elevated className="px-6 py-3 text-center shadow-2xl">
     <div className="text-[11px] font-black tracking-[0.35em] text-red-300/95">
      VOCÊ MORREU
     </div>
     <div className="mt-1.5 text-sm font-semibold text-[#F4EFE3]">
      {following ? (
       <>
        Espectando:{" "}
        <span className="text-amber-200">{spectateTargetName}</span>
       </>
      ) : (
       <span className="text-[#B9B29F]">Câmera livre</span>
      )}
     </div>
     <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-[#6F6A5B]">
      <span>
       <kbd className="rounded border border-white/15 bg-white/[0.04] px-1 font-mono text-[#B9B29F]">
        Espaço
       </kbd>{" "}
       câmera livre
      </span>
      <span>
       <kbd className="rounded border border-white/15 bg-white/[0.04] px-1 font-mono text-[#B9B29F]">
        1
       </kbd>{" "}
       próximo aliado
      </span>
      <span>
       <kbd className="rounded border border-white/15 bg-white/[0.04] px-1 font-mono text-[#B9B29F]">
        Enter
       </kbd>{" "}
       chat squad
      </span>
     </div>
    </Panel>
   </div>

   {/* Squad chat dock bottom-right */}
   <div className="absolute bottom-28 right-4 z-30">
    <SquadChat
     compact
     defaultChannel="squad"
     messages={messages}
     onSend={onSendChat}
     onFocusChange={onChatFocusChange}
    />
   </div>
  </div>
 );
}
