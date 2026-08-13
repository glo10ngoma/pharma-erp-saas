# Installation POS Offline

## Pre-requis poste

- Navigateur Chromium recent recommande.
- Poste autorise par un administrateur.
- Connexion initiale obligatoire pour bootstrap.
- Stockage local disponible et non bloque par le navigateur.

## Installation navigateur

1. Ouvrir l'application PharmaERP.
2. Se connecter avec un utilisateur autorise POS offline.
3. Aller dans `Offline > Poste`.
4. Verifier le statut du poste, du snapshot et du stockage.
5. Cliquer sur l'action d'installation du navigateur si elle est proposee.

Le manifest utilise :

- Nom : `PharmaERP POS`
- URL de demarrage : `/offline/pos`
- Mode : `standalone`

## Bootstrap initial

1. Depuis `Offline > Bootstrap`, enregistrer ou reprendre le poste.
2. Synchroniser le catalogue, les lots, les allocations, les clients et les parametres.
3. Verifier dans `Offline > Poste` :
   - poste identifie ;
   - snapshot frais ;
   - allocations actives ;
   - stockage `HEALTHY` ou `WARNING`.

## Avant utilisation quotidienne

- Ouvrir `Offline > Poste`.
- Cliquer sur `Verifier maintenant`.
- Lancer `Synchroniser` si le reseau est disponible.
- Ne pas demarrer une vente offline si le statut est `RECOVERY_REQUIRED`.

## Pendant une coupure reseau

- Utiliser `Offline > POS`.
- Les ventes, paiements et consommations restent locaux.
- La synchronisation reprend automatiquement au retour reseau.
- Ne pas vider le stockage navigateur.

## Apres reprise reseau

- Laisser l'auto-sync terminer.
- Verifier la queue dans `Offline > Synchronisation`.
- Controler les conflits dans l'administration offline si necessaire.
- Verifier que les operations critiques sont `SYNCED`.

## Maintenance locale

La page `Offline > Poste` permet :

- verification locale ;
- synchronisation manuelle ;
- preview de nettoyage des donnees synchronisees ;
- export diagnostic JSON.

Il n'existe pas d'action `Tout effacer` en production.

## A ne jamais faire

- Ne pas effacer manuellement les donnees du site dans le navigateur avant synchronisation.
- Ne pas utiliser plusieurs utilisateurs/tenants sur un meme poste sans rebootstrap controle.
- Ne pas ignorer un statut `RECOVERY_REQUIRED`.
- Ne pas lancer les recettes offline partageant `OFFLINE_STAGING` en parallele.
