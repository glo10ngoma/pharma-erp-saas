import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchBox } from '../../components/SearchBox';
import { Modal } from '../../components/Modal';
import { chatService } from '../../services/chat.service';
import { usersService } from '../../services/users.service';
import { formatDate } from '../../utils/date';

export function ChatPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [messageText, setMessageText] = useState('');

  const threads = useQuery({ queryKey: ['chat-threads'], queryFn: async () => (await chatService.getThreads()).data, refetchInterval: 15000 });
  const users = useQuery({ queryKey: ['users'], queryFn: async () => (await usersService.getAll()).data });
  const selectedThread = useMemo(() => threads.data?.find((thread) => thread.threadId === selectedThreadId) ?? threads.data?.[0] ?? null, [selectedThreadId, threads.data]);
  const messages = useQuery({
    queryKey: ['chat-messages', selectedThread?.threadId],
    queryFn: async () => (await chatService.getMessages(selectedThread!.threadId)).data,
    enabled: Boolean(selectedThread?.threadId),
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!selectedThreadId && threads.data?.[0]?.threadId) setSelectedThreadId(threads.data[0].threadId);
  }, [selectedThreadId, threads.data]);

  const createThread = useMutation({
    mutationFn: () => chatService.createThread({ title, threadType: 'GROUP', participantIds }),
    onSuccess: async ({ data }) => {
      setComposeOpen(false);
      setTitle('');
      setParticipantIds([]);
      await qc.invalidateQueries({ queryKey: ['chat-threads'] });
      setSelectedThreadId(data.threadId);
    },
  });

  const send = useMutation({
    mutationFn: () => chatService.sendMessage(selectedThread!.threadId, { messageText }),
    onSuccess: async () => {
      setMessageText('');
      await qc.invalidateQueries({ queryKey: ['chat-messages', selectedThread?.threadId] });
      await qc.invalidateQueries({ queryKey: ['chat-threads'] });
    },
  });

  const filteredThreads = useMemo(() => (threads.data ?? []).filter((thread) => [thread.title, thread.siteName, thread.lastMessageText].some((value) => String(value ?? '').toLowerCase().includes(search.trim().toLowerCase()))), [search, threads.data]);

  function submitThread(event: FormEvent) {
    event.preventDefault();
    createThread.mutate();
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    if (!messageText.trim() || !selectedThread) return;
    send.mutate();
  }

  return (
    <div className="chat-page">
      <div className="page-heading reference-heading">
        <div><h1>Messagerie interne</h1><p className="muted">Coordination legere entre vendeurs, responsables et caisse.</p></div>
        <button className="button compact-button" onClick={() => setComposeOpen(true)}>Nouvelle discussion</button>
      </div>

      <div className="chat-layout">
        <section className="card chat-threads">
          <SearchBox value={search} onChange={setSearch} placeholder="Rechercher une discussion..." />
          {threads.isLoading ? <p className="loading-state">Chargement des discussions...</p> : filteredThreads.length === 0 ? <p className="empty-state">Aucune discussion.</p> : (
            <div className="chat-thread-list">
              {filteredThreads.map((thread) => (
                <button className={`chat-thread-item ${selectedThread?.threadId === thread.threadId ? 'active' : ''}`} key={thread.threadId} onClick={() => setSelectedThreadId(thread.threadId)}>
                  <strong>{thread.title}</strong>
                  <span className="muted">{thread.lastMessageText ?? 'Aucun message'}</span>
                  <small>{thread.unreadCount > 0 ? `${thread.unreadCount} non lus` : 'A jour'} • {thread.participantCount} participants</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card chat-messages-panel">
          {!selectedThread ? <p className="empty-state">Choisissez une discussion.</p> : (
            <>
              <div className="chat-thread-header">
                <div>
                  <h3>{selectedThread.title}</h3>
                  <p className="muted">{selectedThread.siteName ?? 'Tous sites'} • {selectedThread.threadType}</p>
                </div>
              </div>
              <div className="chat-message-list">
                {messages.isLoading ? <p className="loading-state">Chargement des messages...</p> : (messages.data ?? []).length === 0 ? <p className="empty-state">Aucun message.</p> : messages.data!.map((message) => (
                  <article className="chat-message-card" key={message.messageId}>
                    <header><strong>{message.authorName ?? 'Utilisateur'}</strong><span className="muted">{formatDate(message.createdAt)}{message.workstationName ? ` • ${message.workstationName}` : ''}</span></header>
                    <p>{message.messageText}</p>
                  </article>
                ))}
              </div>
              <form className="chat-compose" onSubmit={submitMessage}>
                <textarea className="input" rows={3} placeholder="Ecrire un message interne utile..." value={messageText} onChange={(event) => setMessageText(event.target.value)} />
                <div className="modal-actions"><button className="button compact-button" disabled={send.isPending || !messageText.trim()}>{send.isPending ? 'Envoi...' : 'Envoyer'}</button></div>
              </form>
            </>
          )}
        </section>
      </div>

      <Modal title="Nouvelle discussion" open={composeOpen} onClose={() => setComposeOpen(false)}>
        <form className="form-grid reference-form" onSubmit={submitThread}>
          <label><span>Titre</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label><span>Participants</span><select className="input" multiple value={participantIds} onChange={(event) => setParticipantIds(Array.from(event.target.selectedOptions).map((option) => option.value))}>{(users.data ?? []).map((user) => <option key={user.userId} value={user.userId}>{user.fullName}</option>)}</select></label>
          <div className="modal-actions"><button className="button compact-button" disabled={createThread.isPending}>{createThread.isPending ? 'Creation...' : 'Creer'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
