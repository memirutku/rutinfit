"use client";

import { useEffect, useRef } from "react";
import { Bot, X } from "lucide-react";
import { ActionProposalCard, type ProposalActionState } from "./ActionProposalCard";
import type { CardProposal, CoachMessage } from "./types";

export interface MessageActionState extends ProposalActionState {
  isRejected: boolean;
}

export interface ProposalHandlers {
  onApprove: (proposal: CardProposal, messageId: string) => void;
  onReject: (proposal: CardProposal, messageId: string) => void;
  onToggleEdit: (proposal: CardProposal, messageId: string) => void;
  onEditTitle: (proposal: CardProposal, value: string) => void;
}

function BotAvatar() {
  return (
    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
      <Bot className="w-4 h-4" />
    </div>
  );
}

interface MessageBubbleProps extends ProposalHandlers {
  message: CoachMessage;
  state: MessageActionState;
}

/** Tek mesaj balonu; asistan mesajında varsa eylem taslağı kartı veya iptal notu. */
export function MessageBubble({ message: m, state, onApprove, onReject, onToggleEdit, onEditTitle }: MessageBubbleProps) {
  const isUser = m.role === "user";
  const proposal = m.proposal;

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <BotAvatar />}

      <div className={`max-w-xl space-y-3 ${isUser ? "items-end" : ""}`}>
        <div
          className={`p-4 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-slate-900 text-white rounded-tr-none shadow-xs"
              : m.isError
              ? "bg-amber-50 text-amber-950 border border-amber-200 rounded-tl-none"
              : "bg-slate-100/80 text-slate-800 rounded-tl-none border border-slate-200/50"
          }`}
        >
          <div className="whitespace-pre-wrap">{m.content}</div>
        </div>

        {m.safetyNotice && (
          <div role="note" className="max-w-[85%] p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs leading-relaxed">
            {m.safetyNotice}
          </div>
        )}

        {/* Yapılandırılmış Eylem Taslak Kartı */}
        {proposal && !state.isRejected && (
          <ActionProposalCard
            proposal={proposal}
            isApplied={state.isApplied}
            isEditing={state.isEditing}
            isBusy={state.isBusy}
            onApprove={() => onApprove(proposal, m.id)}
            onReject={() => onReject(proposal, m.id)}
            onToggleEdit={() => onToggleEdit(proposal, m.id)}
            onEditTitle={(value) => onEditTitle(proposal, value)}
          />
        )}

        {/* Vazgeçilmiş Taslak Bildirimi */}
        {proposal && state.isRejected && (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 text-xs italic flex items-center gap-1.5">
            <X className="w-3.5 h-3.5 text-slate-400" />
            <span>Bu öneri taslağı kullanıcı tarafından iptal edildi.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <BotAvatar />
      <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none text-sm text-slate-500 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
        <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
        <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
        <span className="text-xs">Yerel model hesaplıyor ve yanıt üretiyor...</span>
      </div>
    </div>
  );
}

interface MessageListProps extends ProposalHandlers {
  messages: CoachMessage[];
  loading: boolean;
  stateFor: (messageId: string) => MessageActionState;
}

/** Kaydırılabilir mesaj listesi; yeni mesajda veya yanıt beklerken en alta kayar. */
export function MessageList({ messages, loading, stateFor, ...handlers }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} state={stateFor(m.id)} {...handlers} />
      ))}
      {loading && <TypingIndicator />}
      <div ref={endRef} />
    </div>
  );
}
