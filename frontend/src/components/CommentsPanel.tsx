import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { commentsService, EntityComment } from '../services/comments.service';
import { formatDate } from '../utils/date';

export function CommentsPanel({
  entityType,
  entityId,
  title = 'Commentaires',
}: {
  entityType: string;
  entityId: string;
  title?: string;
}) {
  const qc = useQueryClient();
  const { currentUser, permissions } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [visibilityScope, setVisibilityScope] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: async () => (await commentsService.getByEntity(entityType, entityId)).data,
    enabled: Boolean(entityId),
  });

  const create = useMutation({
    mutationFn: () => commentsService.create({ entityType, entityId, parentCommentId: replyTo || undefined, commentText, visibilityScope }),
    onSuccess: () => {
      setCommentText('');
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
    },
  });

  const remove = useMutation({
    mutationFn: (commentId: string) => commentsService.remove(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', entityType, entityId] }),
  });

  const rows = query.data ?? [];
  const commentsByParent = useMemo(() => {
    const map = new Map<string, EntityComment[]>();
    for (const row of rows) {
      const key = row.parentCommentId ?? 'root';
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    }
    return map;
  }, [rows]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!commentText.trim()) return;
    create.mutate();
  }

  return (
    <section className="card compact-card comments-panel">
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          <p className="muted">Commentaires metier, notes equipe et historique contextuel.</p>
        </div>
      </div>

      {permissions.includes('comments.create') && (
        <form className="comments-form" onSubmit={submit}>
          <textarea
            className="input"
            rows={3}
            placeholder={replyTo ? 'Repondre...' : 'Ajouter un commentaire utile a l equipe...'}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
          />
          <div className="comments-form-actions">
            <select className="input compact-input comments-visibility" value={visibilityScope} onChange={(event) => setVisibilityScope(event.target.value as 'PUBLIC' | 'PRIVATE')}>
              <option value="PUBLIC">Equipe</option>
              <option value="PRIVATE">Privee</option>
            </select>
            {replyTo && <button className="ghost-button compact-button" type="button" onClick={() => setReplyTo(null)}>Annuler la reponse</button>}
            <button className="button compact-button" disabled={create.isPending || !commentText.trim()}>{create.isPending ? 'Envoi...' : replyTo ? 'Repondre' : 'Commenter'}</button>
          </div>
        </form>
      )}

      {query.isLoading ? (
        <p className="loading-state">Chargement des commentaires...</p>
      ) : rows.length === 0 ? (
        <p className="empty-state">Aucun commentaire pour le moment.</p>
      ) : (
        <div className="comments-list">
          {(commentsByParent.get('root') ?? []).map((row) => (
            <CommentCard
              key={row.commentId}
              comment={row}
              replies={commentsByParent.get(row.commentId) ?? []}
              canDelete={permissions.includes('comments.delete') || currentUser?.id === row.authorId}
              onDelete={() => remove.mutate(row.commentId)}
              onReply={() => setReplyTo(row.commentId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CommentCard({
  comment,
  replies,
  canDelete,
  onDelete,
  onReply,
}: {
  comment: EntityComment;
  replies: EntityComment[];
  canDelete: boolean;
  onDelete: () => void;
  onReply: () => void;
}) {
  return (
    <article className="comment-card">
      <header className="comment-meta">
        <div>
          <strong>{comment.authorName ?? 'Utilisateur'}</strong>
          <span className="muted">{formatDate(comment.createdAt)} {comment.workstationName ? `• ${comment.workstationName}` : ''}</span>
        </div>
        <div className="comment-actions">
          <span className={`badge compact-badge ${comment.visibilityScope === 'PRIVATE' ? 'badge-warning' : 'badge-muted'}`}>{comment.visibilityScope === 'PRIVATE' ? 'Privee' : 'Equipe'}</span>
          <button className="ghost-button compact-button" type="button" onClick={onReply}>Repondre</button>
          {canDelete && <button className="ghost-button compact-button" type="button" onClick={onDelete}>Supprimer</button>}
        </div>
      </header>
      <p>{comment.commentText}</p>
      {replies.length > 0 && (
        <div className="comment-replies">
          {replies.map((reply) => (
            <div className="comment-reply" key={reply.commentId}>
              <strong>{reply.authorName ?? 'Utilisateur'}</strong>
              <span className="muted">{formatDate(reply.createdAt)}</span>
              <p>{reply.commentText}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
