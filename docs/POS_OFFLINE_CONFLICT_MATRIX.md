# POS Offline Conflict Matrix

## But

Documenter les conflits attendus pour le moteur offline avec replay serveur.

## Matrice

| Situation | Detection locale | Reaction courante | Resultat attendu |
|---|---:|---|---|
| Quantite demandee superieure au disponible local | Oui | Blocage local | Pas d'envoi serveur |
| Allocation epuisee avant sync | Partielle | Conflit au replay | `ALLOCATION_EXHAUSTED` |
| Allocation suspendue / revoquee | Partielle | Conflit au replay | `ALLOCATION_REVOKED` |
| Lot bloque apres vente locale | Non | Conflit au replay | `LOT_BLOCKED_AFTER_OFFLINE_SALE` |
| Lot expire a la date de vente locale | Oui | Blocage local ou conflit replay | `LOT_EXPIRED_AT_OFFLINE_SALE` |
| Stock central incoherent | Non | Conflit au replay | `STOCK_INSUFFICIENT` |
| Poste, site ou lot differents | Non | Conflit au replay | `ALLOCATION_MISMATCH` |
| Stock reserve offline utilise online | Non | Blocage online | `OFFLINE_RESERVED_STOCK_IN_USE` |
| Poste revoque avant replay | Non | Conflit au replay | `WORKSTATION_REVOKED` |
| Session caisse fermee avant replay | Non | Conflit au replay | `CASH_SESSION_CLOSED_AFTER_OFFLINE_SALE` |

## Regles de priorite

1. le lot bloque prime sur tout autre calcul ;
2. le lot expire a la date de vente locale prime sur la quantite disponible ;
3. le statut `REVOKED` bloque immediatement la consommation ;
4. la quantite reservee offline doit etre soustraite du stock vendable online ;
5. une allocation epuisee reste visible mais ne peut plus etre consommee.

## Messages proposes

- `Stock offline insuffisant sur ce poste.`
- `La demande depasse les allocations offline disponibles.`
- `Allocation revoquee par le serveur.`
- `Lot bloque apres la vente offline.`
- `Lot expire a la date de vente offline.`
- `Stock reserve offline indisponible pour ce flux online.`
- `Ce poste offline a ete revoque par l administration.`
- `La session caisse associee n est plus ouverte au moment du replay.`
