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
- Le workflow Inventaire ERP est base sur un prechargement automatique de tous les lots actifs du site.
- Dans un inventaire, l'utilisateur ne saisit que le stock physique et l'observation ; les ecarts, types et valeurs sont calcules automatiquement.

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

## Formulaires

- Labels clairs pour chaque champ.
- Pas de longues descriptions sous les champs.
- Placeholders courts et utiles.
- Champs obligatoires visibles par le contexte et la validation.
- Validation visuelle proche du champ ou de la ligne concernee.
- Modals pour les creations simples.
- Pages dediees pour les flux complexes ou longs.
- Les pages dediees doivent reduire les hauteurs inutiles : labels courts, inputs compacts, boutons compacts et espacement vertical minimal.

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
