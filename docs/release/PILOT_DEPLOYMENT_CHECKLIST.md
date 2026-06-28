# Pilot Deployment Checklist

Date: 28/06/2026

## 1. Environnement

- [ ] Supabase projet pilote cree.
- [ ] Schema PostgreSQL applique.
- [ ] Migrations appliquees.
- [ ] Seed staging/demo applique sans mot de passe clair.
- [ ] Tenant pilote cree.
- [ ] Site principal cree.
- [ ] Role ADMIN cree.
- [ ] Permissions V1 affectees.
- [ ] Admin pilote cree avec hash bcrypt.

## 2. Backend Railway/Render

- [ ] `APP_ENV=production`.
- [ ] `PORT` dynamique fourni par hebergeur.
- [ ] `DATABASE_URL` configure en secret.
- [ ] `JWT_SECRET` long, aleatoire, different de `change_me`.
- [ ] `JWT_EXPIRES_IN` defini.
- [ ] `CORS_ORIGINS` contient uniquement le domaine Vercel pilote.
- [ ] `SUPABASE_URL` configure.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configure uniquement cote serveur si necessaire.
- [ ] Backend build OK.
- [ ] Health/login manuel OK.

## 3. Frontend Vercel

- [ ] `VITE_API_URL` pointe vers backend production.
- [ ] Aucun secret serveur dans Vercel frontend.
- [ ] Frontend build OK.
- [ ] Routes React OK apres refresh.
- [ ] Login admin OK.

## 4. Securite

- [ ] CORS teste depuis domaine autorise.
- [ ] CORS refuse origine non autorisee.
- [ ] `/auth/login` fonctionne.
- [ ] `/auth/me` exige JWT.
- [ ] Permissions admin visibles.
- [ ] Test utilisateur non-admin effectue.
- [ ] Aucune stack trace navigateur.
- [ ] `.env` reels non commites.

## 5. Recette metier minimale pilote

- [ ] Login admin.
- [ ] Dashboard BI visible.
- [ ] Articles visibles.
- [ ] Creation article test.
- [ ] Achat multi-lignes.
- [ ] Validation achat.
- [ ] Lot cree.
- [ ] Stock augmente.
- [ ] POS CASH.
- [ ] Paiement FC.
- [ ] Facture navigateur.
- [ ] Caisse ouverte/fermee.
- [ ] Vente assurance.
- [ ] Creance creee.
- [ ] Paiement creance.
- [ ] Inventaire.
- [ ] Transfert inter-site si plusieurs sites.
- [ ] Balance comptable.
- [ ] Rapport ventes.
- [ ] Notifications.

## 6. Monitoring pilote

- [ ] Personne responsable support identifiee.
- [ ] Canal remontes bugs cree.
- [ ] Sauvegardes Supabase verifiees.
- [ ] Journal incidents pilote cree.
- [ ] Procedure rollback documentee.
- [ ] Export manuel quotidien prevu pendant pilote.

## 7. Conditions Go pilote

- [ ] `npm run validate:rc1` OK sur environnement cible ou staging equivalent.
- [ ] Aucun bug critique ouvert.
- [ ] Utilisateurs pilotes formes.
- [ ] Limitations connues acceptees par le client pilote.

