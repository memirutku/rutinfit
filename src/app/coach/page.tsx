'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Bot,
  Send,
  Utensils,
  Dumbbell,
  Check,
  AlertCircle,
  Clock,
  ArrowRight,
  Paperclip,
  X,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  Calculator,
  Edit3,
  Plus,
} from 'lucide-react';

interface AttachedFile {
  id: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  status: string;
  confidence: 'high' | 'medium' | 'low';
  sourceSummary: string;
  uncertainties: string[];
}

interface MessageItem {
  role: 'user' | 'assistant';
  content: string;
  actionProposal?: any;
  draftId?: string;
  approvalToken?: string;
  isError?: boolean;
  fileIds?: string[];
}

export default function CoachPage() {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      role: 'assistant',
      content:
        'Merhaba! Ben RutinFit yapay zekâ koçunuzum. Hedeflerinize (2.080 kcal hedefi, 2.100 kcal sakin tavanı), bugünkü kalan makrolarınıza ve antrenman durumunuza göre beslenme veya antrenman uyarlamaları önerebilirim. Ayrıca PDF, Excel, Word veya metin formatında beslenme/antrenman programı yükleyebilirsiniz.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);

  // Attached files state
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Action draft states
  const [appliedActions, setAppliedActions] = useState<Record<string, boolean>>({});
  const [rejectedActions, setRejectedActions] = useState<Record<string, boolean>>({});
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    loadConversationList();
  }, []);

  async function loadConversationList() {
    try {
      const res = await fetch('/api/ai/chat');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (e) {
      console.error('Konuşmalar yüklenemedi:', e);
    }
  }

  async function selectConversation(id: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/ai/chat?conversationId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setConversationId(id);
        const applied: Record<string, boolean> = {};
        const rejected: Record<string, boolean> = {};
        const mapped: MessageItem[] = (data.conversation.messages || []).map((m: any, i: number) => {
          const actionProposal = m.actionProposal ? JSON.parse(m.actionProposal) : undefined;
          // Taslağın gerçek durumu veritabanından gelir; onay anahtarı gerekirse yeniden alınır.
          const key = `${i}-${actionProposal?.type}`;
          if (m.draft?.status === 'applied') applied[key] = true;
          if (m.draft?.status === 'rejected') rejected[key] = true;
          return {
            role: m.role as 'user' | 'assistant',
            content: m.content,
            draftId: m.draftId,
            actionProposal,
          };
        });
        setAppliedActions(applied);
        setRejectedActions(rejected);
        setEditingDraftId(null);
        setMessages(mapped.length > 0 ? mapped : messages);
      }
    } catch (e) {
      console.error('Konuşma yükleme hatası:', e);
    } finally {
      setLoading(false);
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setAttachedFiles([]);
    setAppliedActions({});
    setRejectedActions({});
    setEditingDraftId(null);
    setMessages([
      {
        role: 'assistant',
        content:
          'Yeni bir sohbet başlattık. Size nasıl yardımcı olabilirim? Öğün önerisi, antrenman ayarlaması veya program dosyanızı yükleyebilirsiniz.',
      },
    ]);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Dosya yüklenemedi.');
        }

        const newAttached: AttachedFile = {
          id: data.file.id,
          originalName: data.file.originalName,
          sizeBytes: data.file.sizeBytes,
          mimeType: data.file.mimeType,
          status: data.file.status,
          confidence: data.artifact?.confidence || 'medium',
          sourceSummary: data.artifact?.sourceSummary || 'Belge',
          uncertainties: data.artifact?.uncertainties || [],
        };

        setAttachedFiles((prev) => [...prev, newAttached]);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Yükleme sırasında hata oluştu.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeAttachedFile(id: string) {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const quickPrompts = [
    'Bugünkü protein hedefimi tamamlamak için akşam ne yiyebilirim?',
    'Evde yumurta, yoğurt, tavuk ve bulgur var; 2.080 kcal hedefine uyan bir yemek öner.',
    'Bugün işten çok yorgun geldim, antrenmanımı 25 dakikalık daha hafif bir sürüme çevir.',
    'OpenGym antrenman durumumu ve bu haftaki ilerlememi özetle.',
  ];

  async function sendMessage(textToSend?: string) {
    const text = textToSend || input;
    if ((!text.trim() && attachedFiles.length === 0) || loading) return;

    const currentFileIds = attachedFiles.map((f) => f.id);
    const newMessages = [...messages, { role: 'user' as const, content: text, fileIds: currentFileIds }];
    setMessages(newMessages);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          conversationId: conversationId || undefined,
          fileIds: currentFileIds,
        }),
      });

      const data = await res.json();
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
        loadConversationList();
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          actionProposal: data.actionProposal,
          draftId: data.actionProposal?.draftId,
          approvalToken: data.actionProposal?.approvalToken,
          isError: data.isError,
        },
      ]);
      setAttachedFiles([]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '⚠️ İstek gönderilirken bir hata oluştu. Lütfen yerel modelinizin (Ollama / LM Studio) çalıştığından emin olun.',
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Two-phase commit approval via /api/ai/actions
  async function handleApproveAction(proposal: any, idx: number, editedData?: any) {
    const actionKey = `${idx}-${proposal.type}`;
    const draftId = proposal.draftId;
    if (busyActionKey) return; // çift tıklama koruması

    if (!draftId) {
      setActionErrorMessage('Taslak kimliği bulunamadı.');
      return;
    }

    setBusyActionKey(actionKey);
    try {
      let approvalToken: string | undefined = proposal.approvalToken;
      if (!approvalToken) {
        // Geçmiş sohbetten açılan öneri: ham anahtar saklanmadığı için yenisi istenir.
        const reissue = await fetch('/api/ai/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId, action: 'reissue' }),
        });
        const reissued = await reissue.json();
        if (!reissue.ok) throw new Error(reissued.error || 'Onay anahtarı alınamadı.');
        approvalToken = reissued.approvalToken;
      }

      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          approvalToken,
          action: 'approve',
          editedChanges: editedData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'İşlem uygulanamadı.');
      }

      setAppliedActions((prev) => ({ ...prev, [actionKey]: true }));
      setEditingDraftId(null);
      setActionSuccessMessage(`"${proposal.title || 'Taslak'}" başarıyla onaylandı ve plana eklendi! ✓`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Onaylama sırasında bir hata oluştu.');
      setTimeout(() => setActionErrorMessage(null), 5000);
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleRejectAction(proposal: any, idx: number) {
    const actionKey = `${idx}-${proposal.type}`;
    const draftId = proposal.draftId;

    if (!draftId) {
      setRejectedActions((prev) => ({ ...prev, [actionKey]: true }));
      return;
    }

    try {
      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          action: 'reject',
          reason: 'Kullanıcı vazgeçti',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Taslak iptal edilemedi.');
      }

      setRejectedActions((prev) => ({ ...prev, [actionKey]: true }));
      setEditingDraftId(null);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Vazgeçme sırasında bir hata oluştu.');
      setTimeout(() => setActionErrorMessage(null), 5000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Oturum Çubuğu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              AI Sağlık & Beslenme Koçu 🤖
            </h2>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              Yerel-First & Güvenli Eylem
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Ollama / LM Studio ile yerel çalışır; çok formatlı dosya yükleme ve 2 aşamalı onaylı eylem motoru içerir.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {conversations.length > 0 && (
            <select
              value={conversationId || ''}
              onChange={(e) => {
                if (e.target.value) selectConversation(e.target.value);
              }}
              className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 max-w-[200px] truncate"
            >
              <option value="">Geçmiş Sohbetler ({conversations.length})</option>
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={startNewConversation}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yeni Sohbet</span>
          </button>
        </div>
      </div>

      {/* Bildirim Mesajları */}
      {actionSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {actionErrorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{actionErrorMessage}</span>
        </div>
      )}

      {/* Hızlı Komut Butonları */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            disabled={loading}
            onClick={() => sendMessage(p)}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:border-brand-500 hover:text-brand-600 rounded-xl text-xs font-semibold text-slate-600 whitespace-nowrap transition-colors shadow-2xs disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Sohbet Alanı */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[70vh]">
        {/* Mesaj Listesi */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            const actionKey = `${idx}-${m.actionProposal?.type}`;
            const isApplied = appliedActions[actionKey];
            const isRejected = rejectedActions[actionKey];
            const isEditing = editingDraftId === actionKey;

            return (
              <div
                key={idx}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-xl space-y-3 ${isUser ? 'items-end' : ''}`}>
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-slate-900 text-white rounded-tr-none shadow-xs'
                        : m.isError
                        ? 'bg-amber-50 text-amber-950 border border-amber-200 rounded-tl-none'
                        : 'bg-slate-100/80 text-slate-800 rounded-tl-none border border-slate-200/50'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>

                  {/* Yapılandırılmış Eylem Taslak Kartı */}
                  {m.actionProposal && !isRejected && (
                    <div className="p-4 bg-white rounded-xl border border-brand-200 shadow-sm space-y-3 text-xs">
                      {/* Kart Başlığı ve Veri Doğrulama Rozetleri */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                          {m.actionProposal.type === 'meal_proposal' ? (
                            <Utensils className="w-4 h-4 text-brand-600" />
                          ) : (
                            <Dumbbell className="w-4 h-4 text-indigo-600" />
                          )}
                          <span>{m.actionProposal.title}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Onay Bekliyor
                          </span>
                          {m.actionProposal.deterministicMacros && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                              <Calculator className="w-3 h-3 text-emerald-600" />
                              Hesaplandı
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Yemek Önerisi İçeriği */}
                      {m.actionProposal.type === 'meal_proposal' && (
                        <>
                          <p className="text-slate-600 italic">
                            &quot;{m.actionProposal.rationale}&quot;
                          </p>

                          {(() => {
                            // Plana yazılacak değer katalogdan hesaplanandır; model tahmini yalnız yedek.
                            const det = m.actionProposal.deterministicMacros;
                            const macros = det
                              ? { calories: det.totalCalories, proteinG: det.totalProteinG, carbsG: det.totalCarbsG, fatG: det.totalFatG }
                              : m.actionProposal.estimatedMacros;
                            return (
                              <div className="flex flex-wrap gap-2 items-center">
                                <span className="px-2 py-0.5 bg-orange-50 text-orange-700 font-bold rounded">
                                  {macros?.calories} kcal
                                </span>
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded">
                                  P: {macros?.proteinG}g
                                </span>
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-medium rounded">
                                  K: {macros?.carbsG}g
                                </span>
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-medium rounded">
                                  Y: {macros?.fatG}g
                                </span>
                                {!det && <span className="text-[10px] text-slate-400">(model tahmini)</span>}
                              </div>
                            );
                          })()}
                          {m.actionProposal.deterministicMacros?.missingIngredients?.length > 0 && (
                            <p role="note" className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              Katalogda bulunamadı, toplama dahil değil:{' '}
                              {m.actionProposal.deterministicMacros.missingIngredients.join(', ')}
                            </p>
                          )}

                          {m.actionProposal.ingredients && (
                            <div className="bg-slate-50 p-2.5 rounded-lg text-slate-600 space-y-1">
                              <div className="font-semibold text-slate-700">Malzemeler & Porsiyon:</div>
                              {m.actionProposal.ingredients.map((ing: any, i: number) => (
                                <div key={i} className="flex justify-between text-slate-600">
                                  <span>• {ing.foodName}</span>
                                  <span className="font-bold">{ing.grams}g</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* Antrenman Ayarlaması İçeriği */}
                      {m.actionProposal.type === 'workout_adjustment' && (
                        <>
                          <p className="text-slate-600 italic">
                            &quot;{m.actionProposal.reason}&quot;
                          </p>
                          <div className="text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              Hedef Süre: {m.actionProposal.targetDurationMinutes} dakika
                            </span>
                          </div>
                          {m.actionProposal.exercises && (
                            <div className="bg-slate-50 p-2.5 rounded-lg text-slate-600 space-y-1">
                              <div className="font-semibold text-slate-700">Egzersizler:</div>
                              {m.actionProposal.exercises.map((ex: any, i: number) => (
                                <div key={i} className="flex justify-between">
                                  <span>• {ex.exerciseName}</span>
                                  <span className="font-bold">
                                    {ex.sets} set × {ex.repMin}-{ex.repMax} tekrar
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* Düzenleme Alanı */}
                      {isEditing && (
                        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                          <div className="font-bold text-amber-900 text-xs">Taslağı Düzenle:</div>
                          <input
                            type="text"
                            placeholder="Başlık / İsim"
                            defaultValue={m.actionProposal.title}
                            onChange={(e) => {
                              const field = m.actionProposal.type === 'meal_proposal' ? 'title' : 'name';
                              setEditFormData((prev) => ({ ...prev, [field]: e.target.value }));
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded"
                          />
                        </div>
                      )}

                      {/* Eylem Butonları Grubu */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div>
                          {!isApplied && (
                            <button
                              onClick={() => handleRejectAction(m.actionProposal, idx)}
                              className="text-xs text-slate-400 hover:text-slate-600 font-medium underline"
                            >
                              Vazgeç
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!isApplied && (
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setEditingDraftId(null);
                                } else {
                                  setEditingDraftId(actionKey);
                                  // Öğün taslağında başlık alanı "title", antrenmanda "name".
                                  const field = m.actionProposal.type === 'meal_proposal' ? 'title' : 'name';
                                  setEditFormData({ [field]: m.actionProposal.title });
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{isEditing ? 'Kapat' : 'Düzenle'}</span>
                            </button>
                          )}

                          <button
                            disabled={isApplied || busyActionKey === actionKey}
                            onClick={() =>
                              handleApproveAction(
                                m.actionProposal,
                                idx,
                                isEditing ? editFormData : undefined
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              isApplied
                                ? 'bg-emerald-100 text-emerald-800 cursor-default'
                                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
                            }`}
                          >
                            {isApplied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Plana Eklendi ✓</span>
                              </>
                            ) : (
                              <>
                                <ArrowRight className="w-3.5 h-3.5" />
                                <span>Onayla ve Plana Ekle</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Vazgeçilmiş Taslak Bildirimi */}
                  {m.actionProposal && isRejected && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 text-xs italic flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5 text-slate-400" />
                      <span>Bu öneri taslağı kullanıcı tarafından iptal edildi.</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none text-sm text-slate-500 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                <span className="text-xs">Yerel model hesaplıyor ve yanıt üretiyor...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Dosya Yükleme Ekleri Önizleme Çubuğu */}
        {attachedFiles.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-2xs"
              >
                {file.originalName.endsWith('.xlsx') || file.originalName.endsWith('.csv') ? (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-brand-600" />
                )}
                <span className="font-medium truncate max-w-[150px]">{file.originalName}</span>
                <span className="text-[10px] text-slate-400">
                  ({(file.sizeBytes / 1024).toFixed(0)} KB)
                </span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                    file.confidence === 'high'
                      ? 'bg-emerald-100 text-emerald-800'
                      : file.confidence === 'medium'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {file.confidence}
                </span>
                <button
                  onClick={() => removeAttachedFile(file.id)}
                  className="text-slate-400 hover:text-rose-600 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Yükleme veya Hata Bildirimi */}
        {uploading && (
          <div className="px-4 py-1.5 bg-blue-50 text-blue-700 text-xs flex items-center gap-2 border-t border-blue-100">
            <UploadCloud className="w-3.5 h-3.5 animate-bounce" />
            <span>Dosya ayrıştırılıyor ve güvenlik filtresinden geçiriliyor...</span>
          </div>
        )}
        {uploadError && (
          <div className="px-4 py-1.5 bg-rose-50 text-rose-700 text-xs flex items-center justify-between border-t border-rose-100">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Mesaj ve Dosya Giriş Alanı */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Gizli Dosya Seçici */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.csv,.docx,.txt,.md,.json,.png,.jpg,.jpeg,.webp"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              disabled={loading || uploading}
              onClick={() => fileInputRef.current?.click()}
              title="Dosya Yükle (PDF, Excel, Word, TXT, JSON, Görsel)"
              className="p-2.5 bg-white border border-slate-200 hover:border-brand-500 text-slate-500 hover:text-brand-600 rounded-xl transition-colors shadow-2xs disabled:opacity-50"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              placeholder="Sorunuzu yazın veya dosya yükleyip 'bunu analiz et' deyin..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
            />

            <button
              type="submit"
              disabled={loading || (!input.trim() && attachedFiles.length === 0)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-1.5 font-bold text-sm shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Gönder</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
