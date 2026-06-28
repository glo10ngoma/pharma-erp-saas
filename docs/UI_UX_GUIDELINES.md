# UI/UX Guidelines V1.1

Ce document formalise progressivement l'identite visuelle de l'ERP Pharmaceutique SaaS.

## Couleurs

- Mode clair : fond clair, cartes blanches, bordures legeres.
- Mode sombre : fond sombre, cartes sombres, texte lisible.
- Couleur primaire : bleu professionnel pour les actions principales, les selections et les points d'attention.
- Couleur succes : vert pour les etats valides, confirmations et resultats positifs.
- Couleur alerte : orange pour les avertissements, echeances proches et champs incomplets.
- Couleur erreur : rouge pour les erreurs bloquantes et validations impossibles.
- Couleur information : bleu clair pour les informations secondaires ou contextuelles.

## Layout

- Sidebar stable de 280px.
- Navigation organisee par groupes metier.
- Sous-menus verticaux, lisibles, sans debordement horizontal.
- Pages structurees en cartes simples.
- Modals larges pour les ecrans metier riches, notamment achats, ventes et inventaires.
- Les flux complexes peuvent rester en pages dediees quand l'espace de travail le justifie.
- La page `/purchases/new` est la reference UX pour les flux complexes : breadcrumb, informations generales compactes, grille metier centrale, resume temps reel et actions en bas de page.
- Les futurs modules Ventes, Inventaires, Transferts et Retours doivent reprendre ce modele quand ils manipulent plusieurs lignes.

## Reference Flux Metier Complexe

La page `/purchases/new` - Nouvel Achat - est desormais le modele UI/UX de reference pour les futurs flux metier complexes.

- Utiliser une page complete, pas une modal, lorsque le flux demande une saisie longue, multi-lignes ou transactionnelle.
- Presenter une experience ERP professionnelle : informations generales en haut, grille centrale dense, resume temps reel en bas et boutons principaux toujours visibles.
- La grille doit rester compacte et visible sans scroll horizontal sur ecran Full HD.
- La colonne Article ou Produit est prioritaire et doit recevoir la plus grande largeur disponible.
- Les colonnes `Qte`, `PA`, `PV` et `Total` restent compactes, lisibles, centrees ou alignees a droite selon leur nature.
- Les actions de ligne utilisent uniquement des icones : `+` pour ajouter et corbeille pour supprimer.
- Le selecteur Article doit s'ouvrir dans un popover flottant via portal afin de ne pas etre coupe par la grille ou le scroll horizontal.
- Les themes light et dark doivent rester parfaitement lisibles : contrastes, bordures, hover, icones et etats de validation.
- Le resume temps reel affiche les totaux, quantites et indicateurs financiers sans attendre l'enregistrement.
- Les boutons principaux restent visibles et clairement hierarchises : annuler, enregistrer, valider.
- Ce modele doit etre applique progressivement aux flux : Ventes / POS, Inventaires, Transferts, Retours et Saisie comptable.
- Le POS est un flux metier critique : il doit rester une page complete, jamais une modal.
- Le POS doit etre utilisable au clavier : `F2` recherche article, `Ctrl+Entree` validation, `Ctrl+L` recherche/ligne, `Ctrl+Suppr` suppression, `Echap` retour.
- La recherche article est prioritaire dans le POS et doit etre compatible saisie rapide / futur scan barcode.
- Le resume POS reste visible en permanence : total, part patient, part assurance, montant paye et monnaie.
- La validation POS doit etre rapide, lisible et explicite sur l'etat caisse.
- Le workflow Inventaire ERP est base sur un prechargement automatique de tous les lots actifs du site.
- Dans un inventaire, l'utilisateur ne saisit que le stock physique et l'observation ; les ecarts, types et valeurs sont calcules automatiquement.
- Le FEFO est un assistant decisionnel, pas seulement une regle automatique de vente.
- Les ecrans FEFO doivent guider quotidiennement le personnel sur les produits a mettre en avant, les rotations de rayons, les risques de peremption et les actions recommandees.
- Les alertes FEFO doivent etre explicites : orange pour les lots proches de 30 jours, rouge pour les lots critiques sous 7 jours ou deja expires.
- Les vues FEFO restent en lecture seule : elles orientent les actions terrain sans modifier directement stock, ventes, inventaires ou lots.

## Tableaux

- En-tetes lisibles avec contraste suffisant en light et dark mode.
- Valeurs numeriques alignees a droite.
- Badges de statut coherents sur tous les modules.
- Barre de recherche au-dessus des listes.
- Empty state clair lorsque la liste est vide.
- Sticky header quand le tableau est long.
- Les tables longues Stocks, Lots, Inventaires et Transferts doivent avoir des en-tetes sticky.
- Colonne principale figee lorsque le tableau est large.
- Scroll horizontal propre sur ecran portable.
- Les pages de stock, lots et inventaires utilisent des lignes compactes pour afficher plus de donnees sans perdre la lisibilite.
- Les grilles metier Achats, Ventes et Inventaires doivent rester compactes et eviter le scroll horizontal sur ecran Full HD.
- Reserver la largeur maximale a la colonne metier principale, par exemple Article ou Produit.
- Aligner tous les montants a droite.
- Centrer les quantites.
- Utiliser uniquement des icones pour les actions de ligne, avec libelle accessible et tooltip.
- Afficher les donnees principales rapidement ; les calculs lourds et reconstructions historiques doivent etre declenches a la demande.
- Les selecteurs article/lot partages doivent utiliser `FloatingSearchPopover` pour eviter les popovers coupes par les grilles.

## Dashboards

- Le Dashboard Admin est une page decisionnelle, pas une page d'accueil vide.
- Les profils `ADMIN` et `MANAGER` arrivent directement sur le Dashboard BI lorsqu'ils possedent `reports.dashboard`.
- Les profils de vente ou caisse arrivent directement sur le POS lorsque leur role et leurs permissions le permettent.
- Un dashboard decisionnel combine toujours : KPIs, graphiques, alertes intelligentes et liens d'action vers les pages metier.
- Les cartes KPI restent compactes, lisibles en light/dark et explicitent la devise de reporting.
- Les graphiques doivent charger sans bloquer toute la page : afficher les donnees disponibles et signaler discretement les rapports indisponibles.
- Les filtres principaux d'un dashboard sont : site, periode, date debut et date fin.
- Les alertes du dashboard doivent orienter l'action : rupture, FEFO, lots expires, creances, caisse.

## Rapports Imprimables

- Le centre `/reports` regroupe les rapports metier imprimables et exportables.
- Chaque rapport doit proposer : filtres, apercu avant impression, KPI de synthese, export Excel, CSV et JSON.
- Le PDF reste desactive tant que la generation fiable n'est pas implementee.
- L'impression utilise une zone dediee avec titre, pharmacie, site, periode, date d'impression, tableau, totaux et pied de page.
- Les rapports doivent reutiliser les composants partages : `ReportPageShell`, `ReportFiltersBar`, `ReportPreview`, `ReportActions` et `ReportKpiCards`.
- Les tableaux de rapport restent compacts, avec en-tetes lisibles, montants alignes a droite et dates au format `jj/mm/aaaa`.
- Les exports respectent toujours les filtres actifs.
- Les rapports prioritaires V1.1 sont : Ventes, Achats, Stocks, Inventaires, FEFO, Caisse, Assurances et Marges.

## Notifications

- Le centre `/notifications` est un assistant quotidien de gestion, pas une simple liste de messages.
- Les notifications V1.1 sont generees au chargement depuis les donnees existantes : stocks, lots FEFO, inventaires, creances, caisse et KPIs rapports.
- Les priorites sont visuelles et stables : rouge critique, orange avertissement, bleu information.
- Chaque notification doit proposer une action utile vers le module concerne : Stocks, FEFO, Caisse, Inventaires ou Assurances.
- Le badge du header affiche les notifications non lues et ne doit pas masquer la navigation principale.
- Les notifications restent exportables en Excel, CSV et JSON ; le PDF reste desactive tant que non pret.

## Analyses Avancees

- Le groupe `Analyses` transforme les donnees en decision : classer, prioriser, recommander et alerter.
- Les analyses doivent toujours combiner KPI, graphique, tableau compact et export.
- Les pages ABC/Pareto classent les produits selon leur contribution au chiffre d'affaires.
- Les analyses de rotation et produits dormants doivent aider a reduire immobilisation stock, ruptures et pertes.
- Les pages Fournisseurs et Vendeurs affichent un etat propre lorsque les donnees disponibles sont insuffisantes.
- Les calculs V1.1 restent en lecture seule et n'ecrivent jamais dans les modules metier.

## Assurance Et Creances

- Le module Assurance & Creances doit couvrir le cycle : vente assurance, creance, bordereau, envoi, paiement, rapprochement et cloture.
- Les paiements assurance reutilisent l'endpoint de paiement de creance existant afin de conserver comptabilite, audit et regles backend.
- Les bordereaux, litiges et relances V2.0 peuvent etre pilotes en frontend tant que le schema dedie n'existe pas ; l'UI doit clairement rester compatible avec les donnees existantes.
- Les tableaux assurance utilisent les memes standards : KPI, filtres, exports, impression, recherche et headers sticky.
- Les alertes assurance prioritaires sont : creance >30 jours, >60 jours, >90 jours, litige ouvert et bordereau a envoyer.

## Formulaires

- Labels clairs pour chaque champ.
- Pas de longues descriptions sous les champs.
- Placeholders courts et utiles.
- Champs obligatoires visibles par le contexte et la validation.
- Validation visuelle proche du champ ou de la ligne concernee.
- Modals pour les creations simples.
- Pages dediees pour les flux complexes ou longs.
- Les pages dediees doivent reduire les hauteurs inutiles : labels courts, inputs compacts, boutons compacts et espacement vertical minimal.

## Pages Referentiel

- Toute page Referentiel doit proposer une recherche visible au-dessus de la liste.
- Toute page Referentiel doit permettre l'export Excel, CSV et JSON des donnees filtrees ; le PDF reste desactive tant qu'il n'est pas pret.
- Les listes Referentiel utilisent des tableaux compacts avec en-tetes sticky, badges actif/inactif et actions visibles en light/dark.
- Les pages Referentiel affichent des cartes resume : total, actifs, inactifs et elements filtres.
- La creation simple se fait en modal compacte avec labels courts, placeholders utiles et boutons Annuler / Enregistrer.
- Les codes generes automatiquement restent modifiables par l'utilisateur.
- Une action Voir ouvre un detail modal lorsque l'information aide vraiment l'utilisateur.
- Les libelles affiches sont des libelles metier propres ; ne pas prefixer les categories, formes, voies ou types par "Demo" dans l'application.

## Raccourcis clavier

- `Ctrl+Entree` : enregistrer.
- `Ctrl+L` : ajouter une ligne.
- `Ctrl+Suppr` : supprimer la ligne selectionnee.
- `Echap` : fermer la modal.
- `Entree` : passer a la ligne suivante ou valider la ligne rapide.
- `Tab` : cellule suivante.
- `Shift+Tab` : cellule precedente.

## Argent, Dates Et Statuts

- Utiliser `formatMoney()` pour tous les montants visibles.
- Afficher explicitement la devise : `USD` ou `FC`.
- Badges de statut coherents entre modules.
- Dates au format lisible pour l'utilisateur.
- Les montants consolides restent explicites sur leur devise de reporting.
