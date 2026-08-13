# POS Offline - Checklist terrain

Cette checklist doit etre executee sur un vrai poste Windows avec Chrome ou Edge, une vraie coupure reseau et une imprimante physique si disponible.

Statuts autorises : `PASS`, `FAIL`, `NON TESTE`.

## Installation poste

| Test | Statut | Notes |
| --- | --- | --- |
| Ouvrir PharmaERP dans Chrome/Edge | NON TESTE | |
| Installer PharmaERP POS en mode application | NON TESTE | Test manuel obligatoire |
| Lancer depuis le raccourci bureau | NON TESTE | |
| Verifier le mode standalone sans chrome navigateur visible | NON TESTE | |
| Login utilisateur POS offline | NON TESTE | |
| Enregistrer le poste avec un nom lisible, ex. CAISSE-01 | NON TESTE | |
| Bootstrap initial complet | NON TESTE | |
| Page Poste indique pret pour les ventes hors ligne | NON TESTE | |

## Demarrage online

| Test | Statut | Notes |
| --- | --- | --- |
| Internet actif | NON TESTE | |
| Ouvrir caisse offline | NON TESTE | |
| Faire une premiere vente online/local-ready | NON TESTE | |
| Imprimer ticket | NON TESTE | Imprimante physique |
| Verifier ticket lisible | NON TESTE | |

## Coupure reelle

| Test | Statut | Notes |
| --- | --- | --- |
| Couper Wi-Fi ou Ethernet reellement | NON TESTE | Ne pas mocker fetch |
| Bandeau hors ligne visible et non bloquant | NON TESTE | |
| Vente offline 1 avec scan | NON TESTE | |
| Vente offline 2 avec scan | NON TESTE | |
| Vente multi-lignes | NON TESTE | |
| Quantite modifiee au clavier | NON TESTE | |
| Depense offline | NON TESTE | |
| Panier long utilisable sans scroll horizontal global | NON TESTE | |

## Persistance locale

| Test | Statut | Notes |
| --- | --- | --- |
| Refresh navigateur | NON TESTE | |
| Caisse retrouvee apres refresh | NON TESTE | |
| Ventes en attente retrouvees apres refresh | NON TESTE | |
| Queue retrouvee apres refresh | NON TESTE | |
| Fermer completement PWA/navigateur | NON TESTE | |
| Rouvrir et verifier caisse/ventes/pending | NON TESTE | |
| Redemarrage Windows reel | NON TESTE | Test manuel obligatoire |
| Nouvelle vente apres reboot sans Internet | NON TESTE | |

## Fermeture caisse offline

| Test | Statut | Notes |
| --- | --- | --- |
| Compter USD et CDF | NON TESTE | |
| Fermer caisse offline | NON TESTE | |
| Ecart affiche Equilibre / Excedent / Manquant | NON TESTE | |
| Rapport de fermeture imprimable | NON TESTE | |

## Reconnexion et auto-sync

| Test | Statut | Notes |
| --- | --- | --- |
| Reactiver Internet | NON TESTE | |
| Ne cliquer sur rien | NON TESTE | |
| Auto-sync demarre seule | NON TESTE | |
| Ordre OPEN -> ventes -> depenses -> CLOSE respecte | NON TESTE | |
| ERP central contient ventes | NON TESTE | |
| ERP central contient paiements | NON TESTE | |
| ERP central contient mouvements caisse | NON TESTE | |
| ERP central contient session fermee | NON TESTE | |
| Zero duplication ticket local / vente serveur | NON TESTE | |

## Recovery terrain

| Test | Statut | Notes |
| --- | --- | --- |
| Crash apres commit local avant ecran succes | NON TESTE | Vente retrouvee |
| Crash avant encaissement | NON TESTE | Pas de vente fantome |
| Crash pendant synchronisation | NON TESTE | Retry meme operationId |
| Imprimante indisponible | NON TESTE | Vente conservee, reimpression possible |
| Storage health visible | NON TESTE | Ne pas remplir dangereusement le disque |

## Supervision

| Test | Statut | Notes |
| --- | --- | --- |
| Heartbeat visible admin | NON TESTE | |
| Last seen mis a jour | NON TESTE | |
| App version visible | NON TESTE | |
| DB version visible | NON TESTE | |
| Poste passe Offline apres expiration heartbeat | NON TESTE | |
| Poste repasse Online apres reconnexion | NON TESTE | |
| Apres sync complete, poste sain | NON TESTE | |

## Decision terrain

`FIELD_READY = NO`

Passer a `YES` uniquement apres execution reelle des tests critiques : installation PWA, coupure reseau, reboot Windows, imprimante et auto-sync terrain.
