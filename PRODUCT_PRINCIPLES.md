# ERP Pharmaceutique SaaS — Product Principles

## 1. Vision produit

L'ERP ne doit pas etre seulement un logiciel de pharmacie.
Il doit devenir un assistant intelligent qui accompagne le pharmacien dans ses operations quotidiennes.

## 2. Principes fondamentaux

- Reduire les clics.
- Reduire les erreurs humaines.
- Automatiser tout ce qui peut l'etre.
- Recommander les bonnes actions.
- Donner la priorite au clavier, au scanner et aux flux rapides.
- Construire les workflows selon le fonctionnement reel d'une pharmacie.
- Ne jamais demander a l'utilisateur une information que le systeme connait deja.
- Afficher uniquement l'information utile au bon moment.
- Empecher les erreurs critiques plutot que simplement les signaler.
- Les performances sont une fonctionnalite.
- Une page lente est un defaut.
- Une page blanche est inacceptable.
- Toute nouvelle page doit respecter UI_UX_GUIDELINES.md.

## 3. Regles UX

- Les flux metier complexes utilisent des pages completes.
- Les creations simples utilisent des modales.
- Les ecrans critiques doivent etre utilisables presque sans souris.
- Le POS doit etre pret a vendre des son ouverture.
- Les tableaux longs doivent avoir des lignes compactes et des en-tetes figes.
- Les exports Excel/CSV/JSON doivent etre prevus sur les pages metier.
- Les formats date et monnaie doivent etre homogenes.

## 4. Regles metier pharmacie

- FEFO est obligatoire pour la vente.
- Les lots expires ou bloques ne doivent pas etre vendables.
- Le systeme doit guider la rotation des rayons.
- Le systeme doit aider a reduire les pertes par peremption.
- Les inventaires doivent precharger les lots actifs du site.
- L'utilisateur ne saisit que le stock physique et l'observation.
- Les transferts doivent toujours creer des mouvements stock tracables.
- Aucune modification stock ne doit exister sans stock_movement.

## 5. Regles POS

- Le vendeur ne doit pas choisir le site a chaque vente.
- Le site vient du profil utilisateur.
- La caisse vient de la session ouverte.
- La devise POS V1 est USD.
- Le scan barcode et la recherche manuelle doivent coexister.
- Le flux prioritaire est CASH comptoir rapide.
- Scanner -> ajouter -> scanner suivant -> encaisser -> imprimer -> nouvelle vente.
- Le POS doit etre rapide, tactile, clavier-first et barcode-ready.

## 6. Regles techniques

- tenant_id vient toujours du JWT.
- site_id doit etre controle cote backend.
- Le frontend ne doit jamais fournir tenant_id comme source de verite.
- Les validations critiques sont cote backend.
- Les operations stock doivent etre transactionnelles.
- Les erreurs metier doivent etre explicites.
- Aucun secret ne doit etre commite.
- Les seeds demo ne doivent contenir aucun mot de passe clair sensible.
- validate:mvp et validate:v1 doivent rester OK.

## 7. Regles IA / automatisation future

L'ERP doit progressivement devenir proactif :
- proposer des commandes fournisseurs ;
- detecter les ruptures probables ;
- detecter les anomalies stock ;
- recommander les lots a mettre en avant ;
- aider a la preparation des ordonnances ;
- aider a la decision commerciale et operationnelle.

## 8. Regle finale

A chaque nouvelle fonctionnalite, poser ces questions :
1. Comment travaille reellement l'utilisateur ?
2. Peut-on supprimer une manipulation ?
3. Peut-on eviter une erreur humaine ?
4. Peut-on recommander la bonne action ?
5. Peut-on automatiser la tache ?
