# RC1 Test Scenarios - ERP Pharmaceutique SaaS V1.0

## Scenarios par domaine

### A. Authentification / Permissions

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| AUTH-01 | Login admin | Se connecter avec un compte ADMIN | Redirection vers Dashboard BI, menus admin visibles |
| AUTH-02 | Login vendeur | Se connecter avec un vendeur | Redirection POS ou premiere page autorisee |
| AUTH-03 | Logout/Login | Se deconnecter puis reconnecter | Permissions restaurees, navigation correcte |
| AUTH-04 | Refresh page | Rafraichir `/reports/dashboard` | Session restauree, aucun ecran blanc |
| AUTH-05 | Menus permissions | Comparer menus ADMIN/vendeur | Menus non autorises masques |

### B. Referentiel

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| REF-01 | Articles visibles | Ouvrir `/articles` | Liste chargee, bouton Voir visible |
| REF-02 | Creation article | Creer un article test | Article visible dans la liste |
| REF-03 | Detail article | Cliquer Voir | Modal detail lisible |
| REF-04 | Export article | Export Excel/CSV/JSON | Fichiers generes |
| REF-05 | Categories propres | Ouvrir categories/formes/voies/types | Aucun libelle `Demo ...` |
| REF-06 | Fournisseurs | Ouvrir fournisseurs, rechercher | Recherche fonctionne |
| REF-07 | Clients | Ouvrir clients, rechercher | Recherche fonctionne |
| REF-08 | Assurances | Ouvrir organisations/plans/memberships | Donnees lisibles |

### C. Achats

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| ACH-01 | Achat multi-lignes | Ouvrir `/purchases/new`, ajouter plusieurs lignes | Totaux calcules, lignes valides |
| ACH-02 | Validation achat | Enregistrer puis valider | Achat `VALIDATED` |
| ACH-03 | Lots crees | Ouvrir `/lots` | Lots visibles |
| ACH-04 | Stock augmente | Ouvrir `/stocks` | Quantites augmentees |
| ACH-05 | Export achats | Exporter liste achats | Export conforme filtres |

### D. Lots / Stocks / FEFO

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| STK-01 | Lots visibles | Ouvrir `/lots` | Lots avec expiration et statut |
| STK-02 | FEFO | Ouvrir FEFO highlight/rotation | Priorites visibles |
| STK-03 | Stock actuel | Ouvrir `/stocks` | KPI et tableau visibles |
| STK-04 | Stock faible | Filtrer stock faible | Badge et donnees coherents |
| STK-05 | Stock a date | Choisir une date passee | Mention stock theorique |
| STK-06 | Export stocks | Export Excel/CSV/JSON | Export conforme |

### E. Inventaires

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| INV-01 | Creation inventaire | Creer inventaire | Statut DRAFT |
| INV-02 | Prechargement lots | Demarrer inventaire | Lots actifs visibles |
| INV-03 | Saisie physique | Modifier quantite physique | Ecart calcule |
| INV-04 | Validation | Cloturer puis valider | Mouvement INVENTORY_GAIN/LOSS |
| INV-05 | Export | Export inventaire | Export genere |

### F. Transferts

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| TRF-01 | Creation transfert | Creer transfert DRAFT | Statut DRAFT |
| TRF-02 | Ligne transfert | Ajouter article/lot | Ligne valide |
| TRF-03 | Validation transfert | Valider transfert | Source diminuee, destination augmentee |
| TRF-04 | Mouvements | Verifier mouvements | TRANSFER_OUT et TRANSFER_IN crees |

### G. POS / Ventes

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| POS-01 | Ouverture POS | Ouvrir `/pos` | Vente prete, focus scan |
| POS-02 | Client par defaut | Verifier client | Client comptoir selectionne |
| POS-03 | Client selectionnable | F5 ou clic client | Popover client fonctionne |
| POS-04 | CASH defaut | Ouvrir POS | Type CASH |
| POS-05 | ASSURANCE | F6 ou select | Assurance accessible avec client |
| POS-06 | Scan article | Scanner/rechercher article | Article ajoute FEFO |
| POS-07 | Fusion ligne | Scanner meme article/lot | Quantite incrementee |
| POS-08 | Paiement FC | Encaisser FC | Vente validee |
| POS-09 | Paiement USD | Encaisser USD | Conversion OK |
| POS-10 | Paiement mixte | Saisir USD + FC | Total paye OK |
| POS-11 | Paiement exact | F3 ou bouton | Montant exact rempli |
| POS-12 | Facture | Imprimer | Facture FC/USD lisible |
| POS-13 | Mode caisse | Activer mode caisse | Sidebar masquee |
| POS-14 | Affichage client | Ouvrir affichage client | Route/window client lisible |

### H. Assurances & Creances

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| INS-01 | Vente assurance | Creer vente assurance | Part patient/assurance calculee |
| INS-02 | Creance generee | Valider vente assurance | Creance creee |
| INS-03 | Paiement creance | Payer creance | Statut PAID ou PARTIALLY_PAID |
| INS-04 | Dashboard assurance | Ouvrir `/insurance/dashboard` | KPI visibles |
| INS-05 | Bordereau frontend | Creer bordereau | Bordereau DRAFT local |
| INS-06 | Litige frontend | Creer litige | Litige ouvert local |
| INS-07 | Relances | Ouvrir relances | >30/>60/>90 visibles |

### I. Caisse

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| CAI-01 | Ouverture caisse | Ouvrir session | Une session OPEN |
| CAI-02 | Vente encaisee | Faire vente CASH | Mouvement SALE_PAYMENT |
| CAI-03 | Depense | Creer depense | Mouvement EXPENSE |
| CAI-04 | Fermeture | Fermer avec montant compte | Difference calculee |

### J. Finance

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| FIN-01 | Ecritures | Ouvrir ecritures | Ecritures visibles |
| FIN-02 | Grand livre | Filtrer compte 57 | Mouvements caisse visibles |
| FIN-03 | Balance | Ouvrir balance | Debit = credit |
| FIN-04 | Exports | Export finance | Export genere |

### K. Dashboard BI

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| BI-01 | Login admin | Login admin | Arrive sur BI |
| BI-02 | Graphiques | Ouvrir dashboard | Graphiques visibles |
| BI-03 | Filtre site | Changer site | KPI adaptes |
| BI-04 | FEFO sante | Lire carte FEFO | Pourcentage visible |
| BI-05 | Notifications | Cliquer carte notifications | Ouvre `/notifications` |

### L. Rapports

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| RPT-01 | Centre rapports | Ouvrir `/reports` | Cartes visibles |
| RPT-02 | Rapports metier | Ouvrir ventes/achats/stocks/inventaires/FEFO/caisse/assurance/marges | Apercu visible |
| RPT-03 | Impression | Cliquer Imprimer | Print preview navigateur |
| RPT-04 | Export | Export Excel/CSV/JSON | Fichiers generes |

### M. Notifications

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| NOT-01 | Badge | Verifier header | Badge non lu si notifications |
| NOT-02 | Categories | Ouvrir notifications | Stock/FEFO/creances/caisse visibles |
| NOT-03 | Lu/non lu | Marquer lu puis non lu | Etat persiste |
| NOT-04 | Lien module | Cliquer action | Route module ouverte |

### N. Analyses

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| ANA-01 | Vue ensemble | Ouvrir `/analytics` | KPI et graphiques visibles |
| ANA-02 | ABC | Ouvrir ABC | Classes A/B/C |
| ANA-03 | Rotation | Ouvrir rotation | Statut rapide/normal/lent |
| ANA-04 | Dormants | Ouvrir dormants | Recommandations |
| ANA-05 | Marges | Ouvrir marges | Top marges/faibles |
| ANA-06 | Fournisseurs | Ouvrir fournisseurs | Valeur achetee |
| ANA-07 | Vendeurs | Ouvrir vendeurs | Donnees ou empty state propre |

### O. Administration

| ID | Scenario | Etapes | Resultat attendu |
|---|---|---|---|
| ADM-01 | Utilisateurs | Ouvrir users | Liste et exports |
| ADM-02 | Roles | Ouvrir roles | Permissions visibles |
| ADM-03 | Permissions | Ouvrir permissions | Regroupement lisible |
| ADM-04 | Sites | Ouvrir sites | Liste visible |
| ADM-05 | Caisses | Ouvrir caisses admin | Liste visible |
| ADM-06 | Taux change | Ouvrir taux | Taux visible/modifiable selon droit |
| ADM-07 | Audit | Ouvrir audit logs | Logs visibles |
| ADM-08 | Sauvegardes | Ouvrir sauvegardes | Page explicative/export config |

## Scenarios E2E metier

| ID | Scenario E2E | Resultat attendu |
|---|---|---|
| E2E-01 | Achat -> Lots -> Stock | Achat valide cree lots, stock et mouvements PURCHASE_IN |
| E2E-02 | Achat -> Stock -> POS CASH -> Caisse -> Finance | Vente CASH diminue stock, cree paiement, cash movement, ecriture |
| E2E-03 | Achat -> Stock -> POS ASSURANCE -> Creance -> Paiement -> Finance | Creance assurance creee puis payee, finance equilibree |
| E2E-04 | Stock -> Transfert inter-site -> Stock destination | Source diminuee, destination augmentee, mouvements transfer |
| E2E-05 | Stock -> Inventaire -> Ecart -> Validation | Stock corrige via INVENTORY_GAIN/LOSS |
| E2E-06 | Lot proche expiration -> FEFO Intelligence -> POS | Lot FEFO priorise dans vente |
| E2E-07 | Caisse ouverte -> Vente -> Fermeture | Session fermee avec ecart calcule |
| E2E-08 | Creance >30 jours -> Notification -> Rapport assurance | Notification renvoie au rapport assurance |
| E2E-09 | Admin change taux USD/CDF -> POS facture FC | POS utilise nouveau taux |
| E2E-10 | Rapport caisse journalier imprime | Rapport caisse imprimable et exportable |
| E2E-11 | Article nouveau -> Achat -> Vente | Article cree, achete, vendu |
| E2E-12 | Fournisseur -> Achat -> Rapport fournisseurs | Fournisseur apparait dans analyses |
| E2E-13 | Assurance plan 80% -> Vente -> Creance | Part patient 20%, creance 80% |
| E2E-14 | Membership client -> POS assurance | Membership selectionnable |
| E2E-15 | Inventaire valide -> Stock -> Rapports | Stock et rapport stocks coherents |
| E2E-16 | Notifications stock faible -> Stocks | Lien ouvre Stocks |
| E2E-17 | Analyses ABC -> Top produits | Produits classes A/B/C |
| E2E-18 | Bordereau assurance -> Relance | Bordereau DRAFT detectable |
| E2E-19 | Litige assurance -> Notifications | Litige ouvert genere alerte |
| E2E-20 | Build + validate RC1 | Builds et validations OK |
