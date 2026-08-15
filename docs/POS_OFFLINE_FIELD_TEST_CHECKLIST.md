# POS Offline - Checklist terrain

Cette checklist doit etre executee sur un vrai poste Windows avec Chrome ou Edge, une vraie coupure reseau et une imprimante physique si disponible.

Statuts autorises : `PASS`, `FAIL`, `NON TESTE`.

## Installation poste

| Test | Statut | Notes |
| --- | --- | --- |
| Ouvrir PharmaERP dans Chrome/Edge | PASS | Session terrain Offline 7.1 |
| Installer PharmaERP POS en mode application | PASS | PWA terrain installee |
| Lancer depuis le raccourci bureau | PASS | Ouverture terrain confirmee |
| Verifier le mode standalone sans chrome navigateur visible | PASS | App Shell terrain valide |
| Login utilisateur POS offline | PASS | Authentification terrain confirmee |
| Enregistrer le poste avec un nom lisible, ex. CAISSE-01 | PASS | Poste terrain enregistre |
| Bootstrap initial complet | PASS | Snapshot Fresh et autorisation offline valides |
| Page Poste indique pret pour les ventes hors ligne | PASS | Poste prepare avec snapshot et contexte local |

## Demarrage online

| Test | Statut | Notes |
| --- | --- | --- |
| Internet actif | NON TESTE | |
| Ouvrir caisse offline | PASS | Caisse ouverte pendant la recette terrain |
| Faire une premiere vente online/local-ready | NON TESTE | |
| Imprimer ticket | FAIL | Ticket POS Offline vide en phase 7.1 |
| Verifier ticket lisible | FAIL | Impression terrain non conforme |

## Coupure reelle

| Test | Statut | Notes |
| --- | --- | --- |
| Couper Wi-Fi ou Ethernet reellement | PASS | Coupure reseau terrain reelle |
| Bandeau hors ligne visible et non bloquant | NON TESTE | |
| Vente offline 1 avec scan | PASS | Vente offline terrain effectuee |
| Vente offline 2 avec scan | NON TESTE | |
| Vente multi-lignes | NON TESTE | |
| Quantite modifiee au clavier | NON TESTE | |
| Depense offline | PASS | Depense offline terrain effectuee |
| Panier long utilisable sans scroll horizontal global | NON TESTE | |

## Persistance locale

| Test | Statut | Notes |
| --- | --- | --- |
| Refresh navigateur | NON TESTE | |
| Caisse retrouvee apres refresh | NON TESTE | |
| Ventes en attente retrouvees apres refresh | NON TESTE | |
| Queue retrouvee apres refresh | NON TESTE | |
| Fermer completement PWA/navigateur | PASS | Fermeture/reouverture sans Internet validee |
| Rouvrir et verifier caisse/ventes/pending | PASS | Restauration locale validee |
| Redemarrage Windows reel | PASS | Test manuel obligatoire execute |
| Nouvelle vente apres reboot sans Internet | PASS | Vente possible apres reboot offline |

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
| Reactiver Internet | PASS | Reconnexion terrain effectuee |
| Ne cliquer sur rien | NON TESTE | |
| Auto-sync demarre seule | NON TESTE | Defaut traite par hotfix, retest terrain encore requis |
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
| Heartbeat visible admin | PASS | Vue admin poste offline observee |
| Last seen mis a jour | NON TESTE | |
| App version visible | PASS | Version visible en supervision |
| DB version visible | PASS | DB version visible en supervision |
| Poste passe Offline apres expiration heartbeat | NON TESTE | |
| Poste repasse Online apres reconnexion | NON TESTE | |
| Apres sync complete, poste sain | NON TESTE | |

## Decision terrain

`FIELD_READY = NO`

Passer a `YES` uniquement apres execution reelle des tests critiques : installation PWA, coupure reseau, reboot Windows, imprimante et auto-sync terrain.
